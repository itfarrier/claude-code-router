# Pitfalls Research

**Domain:** Per-provider SOCKS5 egress in the Claude Code Router (CCR) Node/undici gateway
**Researched:** 2026-11-16
**Confidence:** MEDIUM

Code-path findings below were checked against this checkout. The installed `undici` is 7.29.0; its SOCKS5 support is marked experimental. Current Context7 documentation served the nearby v7.30.0 documentation, not the exact installed patch. SOCKS URI spelling and DNS behavior must therefore be verified against the locked runtime, not inferred from current documentation or another SOCKS client.

## Critical Pitfalls

### Pitfall 1: Treating `socks5://` and `socks5h://` as interchangeable without proving where DNS runs

**What goes wrong:**
CCR resolves a provider hostname locally before it opens a SOCKS tunnel. A target with an AAAA record can then select the machine's broken IPv6 route, causing intermittent failure or direct-DNS leakage. This reproduces the failure mode that caused the 2026-11-13 `NO_PROXY` split-egress experiment to be reverted: `api.z.ai` advertised AAAA records while the local IPv6 route was dead. A library may also reject `socks5h://` or accept it while silently changing its resolution behavior.

**Why it happens:**
SOCKS5's protocol carries an address type in its CONNECT request. A domain name can be sent for the proxy to resolve, but the `socks5`/`socks5h` URI distinction is a client-library convention, not a guarantee that every library applies the same semantics. In the installed undici 7.29.0 source, `Socks5ProxyAgent` accepts `socks5://` or `socks://`, passes the target hostname to its SOCKS client, and the address encoder emits the domain address type for a non-IP hostname. That is useful implementation evidence, but does not make the `socks5h://` config scheme supported. IP literals correctly use IP address types and do not perform DNS.

**How to avoid:**
- Define the product contract as “provider hostnames are sent to SOCKS5 for resolution,” then test the emitted SOCKS address type. Do not rely on the URL scheme alone.
- Validate both accepted config spellings explicitly. If undici cannot accept `socks5h://`, normalize it only at a narrow adapter boundary after tests prove remote DNS is retained; never strip `h` as an unverified string rewrite.
- Use a fake SOCKS server in tests to capture CONNECT requests. Assert hostnames use DOMAIN ATYP and that no local resolver is called. Test IPv4 and IPv6 literals separately.
- Test an AAAA-only or dead-local-IPv6 scenario without changing the developer machine's network settings. Confirm the proxy, not the host, resolves the name.
- Treat `NO_PROXY` and the current loopback bypass as policy decisions. `fetchWithSystemProxy` checks bypass rules before choosing a configured proxy; an inherited `NO_PROXY` match can therefore defeat an explicit provider proxy unless precedence is deliberately changed.

**Warning signs:**
Requests work with a numeric IP but fail with a hostname; local DNS queries appear for proxied providers; IPv4 works while AAAA-capable hosts fail; only `socks5://` is accepted despite a UI that advertises `socks5h://`; traces say “proxy” while traffic uses a local route.

**Phase to address:**
**Phase 4 — config and transport foundation.** Lock down scheme validation and proxy-side DNS before provider traffic is moved. Add end-to-end egress checks in **Phase 5**.

---

### Pitfall 2: Invalid or migrated provider proxy config silently turns into inherited or direct egress

**What goes wrong:**
A typo, partial migration, or unsupported scheme is parsed as “no provider proxy.” The request then uses the global proxy, environment proxy, system proxy, or direct egress instead of the operator's intended route. That is a privacy and policy failure, not just a bad validation message.

**Why it happens:**
`parseProviders` constructs a new provider object from an explicit allowlist of fields. Until the new proxy field is added there, it is dropped. Existing parsing helpers also commonly turn malformed values into `undefined`. In the current `fetchWithSystemProxy`, no selected proxy leads to plain `fetch(input, init)`. Therefore a parser that treats an invalid URL as absent can quietly change egress.

**How to avoid:**
- Model three states distinctly: field absent means “inherit today's behavior”; explicit `direct` means “bypass all proxy layers”; valid SOCKS URL means “use this provider proxy.” Do not collapse them into a nullable URL.
- Validate scheme, host, port, paired credentials, percent-encoding, and supported auth before saving or starting a request. Reject unknown values; never fall back after an explicitly configured proxy fails validation.
- Preserve absent-field behavior for old configs. Add migration tests that load old files unchanged, round-trip new values, and reject malformed new values without rewriting them as absent.
- Make the resolver return a typed decision or an error, not just `string | undefined`. A configured provider proxy that cannot be instantiated must fail the request closed.
- Preserve the specified order: provider override first; explicit direct suppresses proxy use; only the unset/inherit state consults `proxy.upstream`, environment, and system settings. Do not let a lower-priority proxy replace an explicit direct decision.

**Warning signs:**
Malformed URLs disappear after save/reload; an explicit `direct` request still reaches the global proxy; a bad SOCKS URL succeeds through the local network; logs show “system” or “direct” after the operator selected a provider proxy.

**Phase to address:**
**Phase 4 — config and transport foundation.** Make fail-closed validation and compatibility tests prerequisites for enabling per-provider routing.

---

### Pitfall 3: Updating `fetchWithSystemProxy` but missing gateway-child fetches

**What goes wrong:**
Core upstream requests use the new provider proxy, but a provider-bound request made inside the managed gateway child still uses the single global proxy from `HTTP_PROXY`/`HTTPS_PROXY`, or bypasses that proxy. The configuration appears correct while egress is split.

**Why it happens:**
CCR has two distinct mechanisms:

1. In-process callers such as `gateway/upstream/executor.ts`, provider probes, and account/token services import `fetchWithSystemProxy`. It resolves global/system settings and passes an explicit undici `ProxyAgent` dispatcher. Its current bypass list includes local addresses and `NO_PROXY`.
2. The managed gateway child gets env proxy variables from `supervisor.ts`. `config-compiler.ts` generates a preload only when a global `upstreamProxyUrl` exists. The preload patches no-dispatcher `globalThis.fetch`, using the bundled undici `fetch` and a global proxy/direct agent. It intentionally leaves calls with `init.dispatcher` on the original global fetch because dispatcher and fetch implementations must use compatible undici versions.

Neither global environment variables nor that preload can infer which provider a fetch belongs to. Updating only one path leaves other provider-bound operations on the old route. Conversely, applying one global child-process proxy cannot implement multiple provider policies.

**How to avoid:**
- Inventory provider-bound network calls separately from non-provider egress. Include upstream attempts, model catalog/refresh, connectivity probes, token refresh, and account endpoints. Keep excluded media, plugin, MCP discovery, and hosted search traffic on the global path as specified.
- Give provider-aware calls an explicit provider identity and a shared egress resolver. Route core requests through a provider-specific dispatcher; wire the child gateway/plugin path at the point where provider identity is known. Do not assume `HTTP(S)_PROXY` can represent per-provider policy.
- Preserve the existing global preload for calls without a provider setting. For calls with a supplied dispatcher, ensure that dispatcher is the intended provider dispatcher and paired with the matching undici `fetch`.
- Document which path each callsite uses, then test one request from each path while recording the selected proxy policy.
- Decide explicitly whether inherited `NO_PROXY` may override a provider proxy. Preserve the loopback/local-address bypass where needed to avoid proxying CCR's own gateway, but do not let broad inherited patterns silently route an external provider directly.

**Warning signs:**
Catalog or OAuth requests use a different exit IP than chat requests; tests pass through `fetchWithSystemProxy` but fail in the managed child; logs show a dispatcher-less fetch; a child request ignores provider config after `init.dispatcher` is supplied; global proxy works only when no provider override is set.

**Phase to address:**
**Phase 5 — provider-bound egress integrations.** Audit and test both fetch paths before declaring provider egress complete.

---

### Pitfall 4: Weak SOCKS handshake/auth handling or leaking credentials in URLs and diagnostics

**What goes wrong:**
Authentication fails but the request retries without authentication, a configured but incomplete username/password pair silently negotiates no-auth, or a parser mishandles credentials containing `@`, `:`, `%`, or non-ASCII characters. A raw proxy URL then leaks username/password through errors, route traces, logs, or UI previews. SOCKS5 username/password authentication also sends the password in cleartext on the client-to-proxy connection.

**Why it happens:**
The SOCKS5 method negotiation and RFC 1929 subnegotiation are separate steps. RFC 1929 lengths are octet counts (1–255), not JavaScript character counts. The installed undici source offers username/password and no-auth when both credentials are present, decodes URL userinfo, and marks SOCKS support experimental. A proxy can select a method different from the one an operator expects. Errors may include low-level details, while route traces currently capture error messages.

**How to avoid:**
- Reject a URL with only one of username/password. Validate decoded UTF-8 credential byte lengths before opening a socket.
- Test split/partial protocol reads, bad SOCKS version, `0xff` no acceptable method, unsupported methods, wrong RFC 1929 version/status, and SOCKS CONNECT failure replies. Do not treat any of these as success or retry them as direct egress.
- If credentials are configured, do not silently accept a no-auth negotiation unless the product explicitly permits that downgrade and the operator selected it.
- Percent-encode userinfo on serialization and decode exactly once. Keep the secret-bearing URL out of errors, logs, route traces, metrics labels, crash reports, and UI text. Record only a redacted proxy identity (for example, mode and non-secret host/port or a stable opaque ID).
- Remember that RFC 1929 is cleartext authentication. Use only a trusted/private path to the SOCKS server, or TLS to the proxy when supported and required; do not present SOCKS username/password as end-to-end encrypted.
- Redact exception messages before they enter `upstream.attempt.outcome`; use typed fields such as `failureStage: proxy-auth` and a sanitized error code.

**Warning signs:**
Proxy credentials appear in snapshots or logs; proxy URL userinfo is visible in route trace; malformed credentials are accepted; a wrong password results in an outbound direct attempt; configured credentials succeed only because a proxy allows no-auth.

**Phase to address:**
**Phase 4 — config and transport foundation** for strict validation and handshake tests; **Phase 5** for trace/log redaction and actual provider routing.

---

### Pitfall 5: Treating proxy failures as provider/model failures in class-switch

**What goes wrong:**
A SOCKS endpoint outage, auth rejection, DNS failure at the proxy, or timeout is converted to an upstream 5xx and recorded as a model bench event. CCR then parks a healthy provider/model and routes around it even after the proxy recovers.

**Why it happens:**
The class-switch executor records bench rows for selected upstream HTTP statuses, including 5xx, while proxy connection failures are transport errors. A tempting error-normalization shortcut maps every failed fetch to 502/503. The existing executor catches network errors and continues class attempts; future changes must not turn “could not reach provider through proxy” into evidence that the model itself is unhealthy.

**How to avoid:**
- Preserve the failure source: local config, SOCKS connect/handshake/auth, proxy DNS/CONNECT reply, TLS-to-origin, or an HTTP response received from the provider.
- Only record provider/model bench data when a provider response or provider-defined quota/refusal signal justifies it. Never synthesize a model 5xx for a SOCKS-layer error.
- Allow the route to try another provider/model when appropriate, but make the trace and request log identify that the leg failed before reaching the provider. Do not contaminate model ranking, success cards, or bench clocks.
- Add regression tests: fail the fake SOCKS proxy while the upstream fixture is healthy; assert no bench row or probe result marks the model unhealthy. Then return a real provider 5xx and assert existing bench behavior is unchanged.

**Warning signs:**
Models get parked while the proxy is down; a proxy authentication error increments provider failure counters; class-switch notices report quota/model unavailability for all routes behind one broken proxy; recovery requires manually clearing bench state.

**Phase to address:**
**Phase 5 — provider egress and class-switch integration.** Include bench isolation tests in the same phase as proxy failure translation.

---

## Moderate Pitfalls

### Pitfall 6: Unbounded proxy dispatcher and per-origin pool cache

**What goes wrong:**
Every unique provider proxy URL creates a new dispatcher. Old agents and their per-origin pools remain open after config changes, holding sockets, ports, credentials, and memory for the lifetime of the process. A raw-URL cache key also retains secrets in memory and treats harmless URL formatting changes as a new pool.

**Prevention:**
The current `system-proxy-fetch.ts` has a module-level `Map<string, Dispatcher>` keyed by full proxy URL and no close/eviction path. Extending this directly to many provider credentials multiplies the lifecycle problem. Use a bounded cache with a secret-safe identity, reuse dispatchers only when normalized endpoint and auth identity match, and close/destroy old dispatchers after in-flight requests drain when config changes or the service stops. Add tests that rotate proxy settings and verify old sockets close. Keep per-origin pool growth in view; a single proxy may still own pools for many upstream origins.

**Warning signs:**
Open socket count grows after editing provider config; old proxy endpoints continue receiving connections; tests hang on undici keep-alive sockets; credentials remain referenced after config replacement.

**Phase to address:**
**Phase 4 — transport foundation**, with shutdown and rotation checks in **Phase 6 — acceptance/hardening**.

---

### Pitfall 7: Confusing proxy connect/handshake deadlines with request timeouts

**What goes wrong:**
Only `headersTimeout`/`bodyTimeout` or a socket connect timeout is configured, so a dead proxy or stalled SOCKS method negotiation is not bounded by the intended request deadline. Or a very short connect timeout is applied to the entire request, breaking slow streaming model responses. Aborting a request may stop the fetch but leave a socket waiting during handshake.

**Prevention:**
Use separate, documented budgets for TCP-to-proxy connect, SOCKS method/auth/CONNECT negotiation, TLS-to-origin, response headers, response body/stream idle, and the caller's overall deadline. Confirm which phases the installed undici 7.29.0 `Socks5ProxyAgent` actually bounds: its source has a 5-second auth wait and CONNECT wait, but handshake completion itself is not visibly covered by those waits. Do not assume an undici `connect` option or `headersTimeout` bounds the complete SOCKS handshake. Propagate the request AbortSignal into setup and destroy the pending socket on abort. Test a proxy that accepts TCP but never replies, a proxy that stalls after auth, and a slow streaming provider.

**Warning signs:**
Requests exceed configured `CCR_UPSTREAM_TIMEOUT_MS`; cancellation leaves sockets open; slow streaming requests are cut off at a connect deadline; proxy stalls are reported only after the caller's much longer timeout.

**Phase to address:**
**Phase 4 — transport foundation** for timeout semantics; **Phase 5** for preserving existing upstream and streaming budgets.

---

### Pitfall 8: Passing HTTP `ProxyAgent` options to a SOCKS dispatcher and assuming they mean the same thing

**What goes wrong:**
Keep-alive, connection limits, timeout settings, TLS options, or dispatcher methods are configured on the wrong object or not propagated. The result is unexpectedly short-lived tunnels, excessive sockets, poor streaming behavior, or options that appear configured but have no effect.

**Prevention:**
Undici's SOCKS dispatcher is not an HTTP CONNECT `ProxyAgent` with a different URL. Check the exact installed version and its option inheritance. The project currently creates an HTTP `ProxyAgent` in `fetchWithSystemProxy` and a separate child preload agent with `headersTimeout`/`bodyTimeout`; new SOCKS code must consciously preserve the intended connection, keep-alive, TLS, and timeout behavior in both paths. Reuse the project's bundled undici module for child fetches and pair its Dispatcher with that version's `fetch`; Node's built-in fetch and installed undici can be different versions. Verify options with an integration test that measures connection reuse and maximum concurrent tunnels.

**Warning signs:**
Different timeout behavior in desktop and CLI; options are accepted but do not change behavior; invalid dispatcher errors such as `UND_ERR_INVALID_ARG`; every request opens a new SOCKS connection.

**Phase to address:**
**Phase 4 — transport foundation**, before broad integration.

---

### Pitfall 9: Ambiguous proxy-failure translation and misleading route traces

**What goes wrong:**
The user sees a generic network error with no indication whether CCR failed to parse config, connect/authenticate with SOCKS, resolve the destination at the proxy, establish TLS, or receive a provider response. Alternatively, the trace exposes the full authenticated proxy URL.

**Prevention:**
Use typed error categories and preserve the original cause internally. Distinguish SOCKS reply codes (for example, connection refused, network unreachable, host unreachable, unsupported address type) from an upstream HTTP status. Add a sanitized trace event that records provider, decision (`inherit`, `direct`, or provider proxy), sanitized proxy identity, and failure stage. Never put raw userinfo into `target`, `error`, or a URL string. Keep the final failure message actionable without claiming the provider itself is down.

**Warning signs:**
All failures collapse to “network error”; provider status counters rise for proxy failures; traces show proxy passwords; retry behavior cannot distinguish a proxy outage from an upstream 429/500.

**Phase to address:**
**Phase 5 — observability and failure handling**, alongside per-provider route selection.

---

### Pitfall 10: Provider egress coverage stops at chat completion

**What goes wrong:**
The visible model request uses the provider proxy, but catalog refresh, provider probe, OAuth refresh, account usage, or token endpoints still use the global system proxy or direct fetch. Users may observe stale models, failed account state, or inconsistent geography.

**Prevention:**
Audit by purpose and callsite, not by feature label. Existing code has `fetchWithSystemProxy` consumers in `gateway/upstream/executor.ts`, `providers/probe.ts`, `providers/account-service.ts`, and other services. Carry provider identity through every provider-bound operation and use the same resolution policy. Keep non-provider egress on the global path. Verify endpoints that call `fetch` directly or run in child processes; do not infer coverage from a successful router request.

**Warning signs:**
Chat works while auto-fetch/probe/OAuth/account refresh fails; only some provider endpoints show the configured exit; provider logs show different egress decisions for adjacent operations.

**Phase to address:**
**Phase 5 — provider-bound egress integrations.**

---

### Pitfall 11: UI hides inheritance, direct mode, or secret handling

**What goes wrong:**
An empty field is unclear (inherit or direct); users think `direct` is a proxy URL; validation runs only after save; userinfo is displayed in plaintext or copied into error notifications; credentials with URL-reserved characters are corrupted by manual string assembly.

**Prevention:**
Expose explicit “Use global/default,” “Direct,” and “SOCKS5 proxy” choices in the existing provider editor. Validate the full URL and credential pair before save, explain that direct bypasses global/env/system proxy, and preserve the unset legacy behavior. Mask userinfo after save, avoid echoing it in toast/error text, and use correct URL serialization for reserved characters. Keep UI state round-trippable through `window.ccr`; do not add a separate proxy screen.

**Warning signs:**
Save/reopen changes the mode; blank means different things in config and UI; username/password are visible in provider cards or screenshots; entering a password with `@` or `:` breaks the endpoint.

**Phase to address:**
**Phase 6 — provider editor and acceptance**, after config semantics are fixed.

---

## Minor Pitfalls

### Pitfall 12: Test runs leave CCR, SOCKS fixtures, or ports running

**What goes wrong:**
A failed integration test leaves a gateway child, helper, or listening socket behind. Later tests connect to stale state, ports remain occupied, or test traffic continues after the check.

**Prevention:**
Use random local ports and explicit `try/finally` teardown for fake SOCKS servers, upstream fixtures, child processes, and every dispatcher (`close()` or `destroy()`). On test failure, terminate the CCR process and all related children/threads, then verify the test ports are free. Do not kill an unrelated process just because it owns a fixed port. If implementation checks change a system setting, record the old value and exact revert step; run helper processes at the lowest priority. Avoid system DNS, route, or proxy changes for routine tests.

**Warning signs:**
Subsequent test runs use an old process; `EADDRINUSE`; hanging test shutdown; unexpected system proxy or route changes after testing.

**Phase to address:**
**Every phase that runs CCR or network helpers**, with a mandatory cleanup gate in **Phase 6 — acceptance/hardening**.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Strip the `h` from `socks5h://` and pass the rest to undici | Reuses one constructor | Can silently change DNS policy; installed undici 7.29.0 does not accept `socks5h:` as-is | Never without an explicit adapter and ATYP/DNS tests |
| Treat malformed provider proxy config as absent | Keeps old config loading | Privacy policy silently falls through to global or direct egress | Never for an explicitly set value |
| Cache dispatchers forever by full URL | Fast lookup and easy implementation | Unbounded pools; old sockets and secrets remain after edits | Only for a fixed process-lifetime singleton; not provider-configurable endpoints |
| Convert every fetch exception to HTTP 502 | Simplifies retry handling | Proxy outages can pollute provider/model bench and user-visible status | Never for class-switch provider health |
| Put provider proxy into child `HTTP_PROXY` for all requests | Small code change | Erases provider scoping and may reroute non-provider egress | Only for a deliberately global proxy |
| Log the full proxy URL to debug auth failures | Convenient diagnosis | Exposes proxy credentials to traces, logs, support bundles | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| undici SOCKS dispatcher | Assume current docs equal installed behavior or that `socks5h:` is accepted | Check the locked undici version; test scheme parsing, DOMAIN ATYP, auth, close/destroy, and options |
| Core fetch (`fetchWithSystemProxy`) | Add provider choice after the current `NO_PROXY` bypass | Resolve policy in an explicit precedence layer; make override/bypass rules intentional and test them |
| Gateway child preload | Assume env-based `HTTP(S)_PROXY` can choose a proxy per provider | Route where provider identity is available; account for the preload's explicit-dispatcher bypass |
| Catalog/probe/account endpoints | Validate chat only | Audit every provider-bound callsite and verify its trace-selected route |
| Class-switch bench | Treat proxy failure as upstream 5xx | Keep proxy-stage errors out of model/provider bench evidence |
| Provider editor | Represent inherit and direct as the same empty value | Provide explicit inherit/direct/proxy states and mask credentials |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One never-closed dispatcher per edited proxy URL | Open sockets and memory grow over time | Bound cache; retire old dispatcher after drain; close on shutdown | After config rotation or long-lived desktop/gateway sessions |
| Unbounded per-origin pools behind each SOCKS dispatcher | Many tunnels even with few providers | Set and verify connections/pipelining limits; monitor origin cardinality | As provider origins or catalog endpoints accumulate |
| Serial retries after slow proxy handshakes | Long tail latency; fallback appears stuck | Separate connect/handshake/request budgets and cancel pending sockets | On proxy outage or high-latency networks |
| Overly aggressive keep-alive or timeout options copied from HTTP proxy | Reconnect storm or prematurely cut streams | Tune from measured stream workload and exact SOCKS Agent option support | During concurrent and long-lived streaming requests |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Local target DNS before SOCKS CONNECT | DNS leaks and requests can follow the dead local IPv6 route | Assert domain ATYP for hostnames; do not call local DNS for proxied hostnames |
| Invalid proxy config fails open | Requests use an unintended egress path | Reject invalid explicit settings and block the request |
| Raw URL userinfo in logs/traces | Proxy credentials leak to files, support data, or UI | Redact at source; log only an opaque proxy identity and stage |
| Partial credentials or silent no-auth negotiation | Configured auth may not be enforced | Require both fields; test server-selected methods and reject unintended downgrade |
| Plaintext RFC 1929 across an untrusted network | Username/password can be observed on the proxy leg | Use trusted/private connectivity or TLS-to-proxy where supported |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| “No proxy” conflates inherit and direct | User cannot predict actual egress | Separate “Use global/default” from “Direct” |
| Proxy errors say provider is unavailable | User may disable or replace a healthy provider | Show “proxy connection/auth failed” distinctly |
| Password appears in editor after save or in an error toast | Secret exposure during normal use | Mask secret and redact URL userinfo everywhere |
| UI accepts a scheme the runtime rejects | Save succeeds but request behavior changes | Validate using the same core parser used at runtime |

## "Looks Done But Isn't" Checklist

- [ ] **DNS semantics:** Capture a fake SOCKS CONNECT and verify hostname requests use DOMAIN ATYP; verify no local DNS is used for those requests.
- [ ] **URI support:** Test `socks5://`, `socks5h://`, credentials, percent-encoded userinfo, IPv4, IPv6, and unsupported schemes against the locked undici version.
- [ ] **Handshake:** Test method rejection, auth rejection, fragmented replies, malformed frames, proxy refusal, and a socket that stalls at every handshake step.
- [ ] **Fail-closed config:** Verify an invalid explicit provider URL produces a configuration/request error, never direct or global fallback; verify old configs with no field keep existing behavior.
- [ ] **Precedence:** Verify provider proxy wins; explicit direct bypasses all proxy layers; unset provider config preserves today's global/env/system behavior.
- [ ] **Bypasses:** Test `NO_PROXY`, loopback, local gateway URLs, and matching external hostnames under both inherit and explicit provider proxy policies.
- [ ] **Both fetch paths:** Verify an in-process `fetchWithSystemProxy` request and a managed gateway-child global fetch select the expected route; verify explicit child dispatchers are not accidentally skipped or paired with the wrong undici.
- [ ] **Provider coverage:** Test router attempt, catalog refresh, probe, token refresh, and account endpoint for the same provider; test excluded non-provider traffic remains global.
- [ ] **Pool lifecycle:** Rotate endpoint and auth, then verify old agents/pools close; verify shutdown and test teardown leave no sockets open.
- [ ] **Timeouts:** Verify proxy connect, method negotiation, auth, CONNECT, TLS, headers, streaming body, and overall abort have bounded, distinct behavior.
- [ ] **Bench isolation:** A proxy failure must not create a provider/model bench row; a real upstream response retains existing bench behavior.
- [ ] **Trace privacy:** Confirm route trace records selected policy and failure stage but never raw username/password or full credential-bearing URL.
- [ ] **UI:** Verify inherit/direct/proxy round-trip through `window.ccr`, reserved credential characters survive save/reload, and secrets remain masked.
- [ ] **Test hygiene:** Stop CCR and all related processes, close dispatchers and local fixtures, verify ports are free, and record/revert any system setting changed.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong DNS semantics or unintended direct egress | HIGH | Disable affected provider override; restore the known global route; inspect captured SOCKS requests and route traces; correct hostname encoding before re-enabling |
| Invalid config silently fell back | HIGH | Stop provider requests; restore previous config; add strict parsing/migration; inspect logs for affected request interval and egress decision |
| Gateway child still used global proxy | MEDIUM | Revert affected child route to global behavior; enumerate child fetch callsites; add provider-aware wiring and path-specific tests |
| Credentials exposed in logs or traces | HIGH | Remove/rotate proxy credentials; restrict/delete affected logs and bundles; add redaction tests before re-enable |
| Proxy outage polluted class-switch bench | MEDIUM | Restore proxy reachability; clear only bench rows created by proxy-stage failures; fix error classification and add no-bench regression test |
| Stale dispatcher pools or test processes remain | MEDIUM | Stop CCR and owned helpers; close/destroy all dispatchers; verify sockets/ports are released; restart only after config and test cleanup are corrected |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| DNS leakage / wrong SOCKS address type | Phase 4: config and transport foundation | Fake SOCKS captures DOMAIN ATYP; test proves no local DNS lookup and no dead-IPv6 direct attempt |
| Invalid config and precedence fail-open | Phase 4: config and transport foundation | Migration, malformed URL, explicit direct, and unset-field tests |
| Child-process/global-fetch divergence | Phase 5: provider-bound egress integrations | Exercise both fetch paths and check provider/global route decisions |
| SOCKS auth edge cases and credential exposure | Phase 4: config and transport foundation; Phase 5: tracing | RFC 1929 boundary/fragment tests; trace/log redaction assertions |
| Proxy failure incorrectly benches model | Phase 5: class-switch integration | Proxy failure creates no bench row; upstream 5xx still follows current bench rules |
| Dispatcher/pool leak | Phase 4: transport foundation; Phase 6: hardening | Rotate proxy config and shut down; verify dispatcher close and no open fixture sockets |
| Connect/request timeout mismatch | Phase 4: transport foundation; Phase 5: integration | Stall each SOCKS phase and stream a slow response; assert correct deadline/cancellation |
| HTTP/SOCKS option mismatch | Phase 4: transport foundation | Test connection reuse, pool limits, timeout behavior, and runtime-compatible fetch/dispatcher pairing |
| Missing catalog/probe/token/account routes | Phase 5: provider-bound egress integrations | Per-operation egress assertions for all provider-bound callsites |
| UI state and credential handling | Phase 6: provider editor and acceptance | Round-trip inherit/direct/SOCKS and check masked secrets |
| Leftover processes, sockets, or system changes | Every test phase; final gate in Phase 6 | Process-tree cleanup, free-port check, and recorded/reverted setting changes |

## Sources

- First-party code inspected (HIGH confidence): `packages/core/src/proxy/system-proxy-fetch.ts` — dispatcher cache, `NO_PROXY`/local bypass, and current global/system selection.
- First-party code inspected (HIGH confidence): `packages/core/src/gateway/core-runtime/supervisor.ts` — child env proxy setup, preload fetch patch, `init.dispatcher` bypass, bundled undici pairing, and merged `NO_PROXY`.
- First-party code inspected (HIGH confidence): `packages/core/src/gateway/core-runtime/config-compiler.ts` — preload is generated only when a global upstream proxy URL is present.
- First-party code inspected (HIGH confidence): `packages/core/src/config/config.ts` — provider config is rebuilt from parsed fields; new config fields require explicit parsing/type support.
- First-party code inspected (HIGH confidence): `packages/core/src/gateway/upstream/executor.ts` and `packages/core/src/class-switch/bench.ts` — upstream error path, HTTP-status bench writes, and class-switch probes.
- First-party code inspected (HIGH confidence): `packages/core/src/providers/probe.ts`, `packages/core/src/providers/account-service.ts`, and provider/catalog callsites using `fetchWithSystemProxy`.
- Installed dependency inspected (HIGH confidence for this checkout only): `node_modules/undici` version 7.29.0, `lib/dispatcher/socks5-proxy-agent.js`, `lib/core/socks5-client.js`, `lib/core/socks5-utils.js`, and `docs/docs/api/Socks5ProxyAgent.md`. Source marks SOCKS5 support experimental, does not accept `socks5h:` directly, and sends hostnames as SOCKS domain addresses; verify again if the dependency version changes.
- Undici official documentation (MEDIUM confidence; Context7 served v7.30.0, adjacent to the installed 7.29.0): https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Socks5ProxyAgent.md and https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Client.md
- Node.js 22 official fetch documentation (MEDIUM confidence): https://nodejs.org/docs/latest-v22.x/api/globals.html#fetch
- SOCKS5 standards: RFC 1928 https://www.rfc-editor.org/rfc/rfc1928 and RFC 1929 https://www.rfc-editor.org/rfc/rfc1929. These were retrieved from the official RFC Editor but the web-fetch confidence classifier returned LOW; treat them as protocol references and confirm implementation details against the locked dependency and wire-level tests.
- Project operational history and constraints (HIGH confidence): `.planning/PROJECT.md`, especially the 2026-11-13 NO_PROXY revert and the rule to stop CCR/helper processes and record/revert system setting changes.

---
*Pitfalls research for: per-provider SOCKS5 proxies in Claude Code Router*
*Researched: 2026-11-16*

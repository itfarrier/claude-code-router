# Project Research Summary

**Project:** Claude Code Router — v1.1 “Per-provider SOCKS5 proxies”
**Domain:** Provider-scoped egress routing in a local Node.js/Undici model gateway
**Researched:** 2026-11-16
**Confidence:** MEDIUM

## Executive Summary

Claude Code Router (CCR) is a local control plane that routes coding-agent requests to providers, models, credentials, and protocols behind one gateway URL. For v1.1, add provider-scoped SOCKS5 or explicit direct egress without changing the gateway request loop or the existing behavior for providers with no override. Research supports using the already-locked `undici@7.29.0` dispatcher in the existing fetch stack; accept `socks5h://` at CCR's boundary and normalize it only after tests prove proxy-side DNS is preserved.

The recommended design is an isolated `packages/core/src/provider-proxy/` module that validates a provider setting, resolves its effective policy for each outbound operation, and supplies an explicit Undici dispatcher. Wire it at existing provider-aware fetch seams, including attempts, probes/catalog refreshes, and account/token calls; carry sanitized decision metadata into the existing trace and logs. The major risks are unintended egress on invalid configuration, local DNS leakage, credential exposure, inconsistent call-site coverage, and confusing proxy failures with provider/model health. Fail closed, prove wire-level SOCKS semantics, classify failures, and manage dispatcher lifecycles.

## Key Findings

### Recommended Stack

Use Node.js `>=22` and the existing locked `undici@7.29.0`; do not add a dependency or change HTTP stacks for this milestone. Undici's `ProxyAgent`/ `Socks5ProxyAgent` supports SOCKS5 authentication and is already compatible with CCR's fetch dispatcher contract. SOCKS support is experimental, so validate behavior against the locked version. Its accepted URL syntax does not include `socks5h://`; normalize that scheme at the narrow config/dispatcher boundary and prove remote DNS at the SOCKS wire level. Pair the dispatcher with `undici.fetch` from the same package.

Keep the legacy `fetchWithSystemProxy` path unchanged for absent settings. Use explicit direct dispatch (not bare/global fetch) to bypass inherited proxy mechanisms. Avoid `socks-proxy-agent`, deprecated `fetch-socks`, second HTTP clients, proxy-chain frameworks, and hand-rolled protocol code. See [STACK.md](STACK.md).

**Core technologies:**
- Node.js `>=22`: maintains the project's runtime contract.
- Existing Undici v7: provides SOCKS5 dispatch without a new dependency or HTTP stack.
- Existing `fetchWithSystemProxy`: preserves legacy global/environment/system behavior when the provider field is absent.

### Expected Features

P1 scope is provider-level SOCKS5 URL (username/password supported), explicit `direct`, and an unambiguous unset/inherit state; strict validation; deterministic precedence; bounded failures; and consistent provider-bound egress across upstream attempts, probes/catalog refresh, and account/token endpoints. The existing provider editor and config flow must round-trip the setting. Trace/log the selected policy safely, never credentials or raw URLs. No proxy failure may silently fall back to direct/global egress.

Differentiators worth considering only after core delivery are a one-shot manual proxy test and clear effective-mode/DNS-mode display. Defer background health checks, latency ranking, multiple proxies/chains/PAC, and per-model/per-credential overrides. See [FEATURES.md](FEATURES.md).

**Must have (table stakes):**
- Provider override, explicit direct, and unset/inherit semantics with stable precedence.
- SOCKS5 auth and proxy-side DNS semantics, including tested `socks5h` acceptance.
- All provider-owned egress call sites use the same provider policy.
- Config/editor round-trip, strict validation, bounded failures, secret redaction, and per-attempt trace visibility.

**Should have (competitive):**
- Manual one-shot proxy test if existing probe seams can support it safely.
- Clear effective choice and DNS mode in the provider editor.

**Defer (v2+):**
- Health monitoring, automatic ranking/failover, proxy chains/PAC, and finer-than-provider scope.

### Architecture Approach

Preserve the existing request loop and legacy fetch API. Put validation, policy resolution, dispatcher creation/cache, and the provider-aware fetch wrapper in a new `provider-proxy/` module. At each existing provider-bound network seam, pass immutable provider context and resolve the policy for that operation; unset delegates unchanged to `fetchWithSystemProxy`. Explicit direct uses an explicit Undici direct Agent because the managed gateway preload may otherwise proxy global fetch. Store config in the existing JSON blob; no database migration is needed. Integrate with existing route trace fields and provider editor; do not mutate process proxy variables or add a new UI screen.

**Major components:**
1. Config contract/parser — optional provider setting; reject malformed explicit values rather than treating them as absent.
2. Provider proxy module — typed resolver, SOCKS/direct dispatcher factory and lifecycle-managed cache, provider-aware fetch, safe decision metadata, and `CCR_PROVIDER_PROXY=0` kill switch.
3. Existing provider-bound call sites and UI/trace seams — attempts, probe/catalog/bench refresh, account/token, editor, and diagnostics; preserve unrelated global egress.

### Critical Pitfalls

1. **Wrong DNS behavior or scheme normalization** — test captured SOCKS CONNECT frames for DOMAIN ATYP and prove no local lookup; check IP literals separately and test against locked Undici.
2. **Invalid explicit setting falls through** — distinguish absent, direct, and SOCKS values; reject invalid input and fail closed, with legacy-config compatibility tests.
3. **Partial call-site or child-path coverage** — inventory every provider-owned request, use explicit provider context, and test attempts, probes, refreshes, token/account flows, and managed-child dispatch behavior.
4. **Proxy errors pollute model health or expose secrets** — classify failures by stage; do not synthesize upstream 5xx/bench failures for SOCKS errors; redact credentials in all errors/traces/logs.
5. **Dispatcher lifecycle and timeout gaps** — bound cache growth, close retired dispatchers, test handshake stalls/abort/streaming, and clean up all test processes and sockets.

## Implications for Roadmap

Suggested phase structure, continuing the project’s existing phase numbering:

### Phase 4: Config and transport foundation
**Rationale:** Every dependent integration needs a reliable contract and proven transport semantics first.
**Delivers:** Optional `provider.proxy` contract/parser; inherit/direct/SOCKS precedence; Undici dispatcher wrapper/cache; `socks5h` normalization backed by DOMAIN ATYP tests; explicit direct; typed failure and timeout behavior; `CCR_PROVIDER_PROXY=0`.
**Addresses:** SOCKS transport, auth, remote DNS, validation, unset compatibility, bounded failures.
**Avoids:** Fail-open parsing, accidental direct fallback, URL credential leakage, dispatcher/fetch version mismatch, unbounded cache, handshake hangs.
**Research flag:** Yes—verify exact locked Undici 7.29.0 behavior, auth downgrade semantics, SOCKS negotiation deadlines, dispatcher options, and shutdown behavior during planning/implementation.

### Phase 5: Provider-bound egress and trace integration
**Rationale:** Once the resolver/transport contract is proven, wire provider context across the narrow live seams and verify consistent policy.
**Delivers:** Per-attempt routing and trace; provider probes, catalog/model refresh, bench probes, and core account/token requests; sanitized failure and route diagnostics; tests for retries across different providers.
**Addresses:** Consistent egress and decision visibility.
**Avoids:** Child/global path divergence, provider state bleeding across concurrent calls, shared OpenRouter catalog accidentally taking a loop-local provider proxy, and proxy outages contaminating model bench state.
**Research flag:** Yes, targeted—especially resolve the Electron WebContents/browser-session account path, which cannot directly accept a core Undici dispatcher. Test provider identity at each call boundary.

### Phase 6: Provider editor and acceptance hardening
**Rationale:** UI exposure should follow a stable shared config contract; finish with end-to-end compatibility and operational checks.
**Delivers:** Existing provider editor field group and config round-trip; explicit inherit/direct/SOCKS choices; masked credentials; kill-switch compatibility; end-to-end tests and teardown checks.
**Addresses:** Editor support, optional manual proxy test only if demanded.
**Avoids:** Ambiguous blank state, plaintext secrets, UI/runtime parser mismatch, leaked sockets/processes, regressions to legacy/global behavior.
**Research flag:** No broad research needed; standard UI/config patterns apply. Keep browser-session coverage decision and acceptance tests as explicit gates.

### Phase Ordering Rationale

- Config and transport semantics are prerequisites: provider-bound traffic must not move until malformed input, DNS, auth, and direct behavior are proven.
- Integration is grouped by provider-owned egress while preserving the existing fetch seams, loop, retry plan, and global path for non-provider traffic.
- UI completes the stable contract, while a final kill-switch and unset-provider regression check proves old configs and parent-compatible behavior remain intact.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4:** Locked Undici behavior is experimental; verify handshake timeout/auth details, remote DNS, direct dispatcher behavior, and cache lifecycle.
- **Phase 5:** Decide whether/how the Electron WebContents browser-session account fetch can honor provider-specific egress. Also confirm the provider call-site inventory and bench classification.

Phases with standard patterns (skip research-phase):
- **Phase 6:** Existing provider editor, typed config round-trip, and trace rendering are established project patterns; focus on acceptance criteria and security checks.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Existing locked package and source support are checked, but SOCKS is experimental; some external version metadata is lower confidence. |
| Features | MEDIUM | Strong project context and convergent operator expectations; competitor docs do not establish equivalent per-provider SOCKS behavior. |
| Architecture | HIGH | Repository integration points and seams inspected; Undici-specific runtime behavior remains medium. |
| Pitfalls | MEDIUM | Repository-specific paths/history checked; protocol and timeout behavior still requires executable tests against the locked package. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Electron WebContents account connector:** Decide if it is in scope, how provider-isolated proxying can be implemented safely, or whether it is an explicit exception.
- **SOCKS DNS/auth/timeout behavior:** Confirm exact wire semantics and failure modes with local fake SOCKS fixtures against `undici@7.29.0`; do not rely only on adjacent-version docs.
- **Proxy precedence and bypass rules:** Existing inherited behavior includes specific `NO_PROXY`/loopback handling and differs in ordering from the milestone’s shorthand chain. Preserve unset behavior; explicitly decide whether explicit provider proxy may be bypassed by those rules.
- **Dispatcher lifecycle/error telemetry:** Define bounded cache eviction, in-flight draining, timeout budgets, and safe typed diagnostics before broad rollout.

## Sources

### Primary (HIGH confidence)
- Project context: [.planning/PROJECT.md](../PROJECT.md) — milestone goal, runtime, egress history, constraints, and scope.
- Repository inspection cited in [ARCHITECTURE.md](ARCHITECTURE.md) and [PITFALLS.md](PITFALLS.md) — fetch seams, gateway preload, config parsing, probes, account service, and class-switch behavior.

### Secondary (MEDIUM confidence)
- Undici v7.29.0 SOCKS5/ProxyAgent docs and Node.js fetch docs — dispatcher contract and scheme behavior; see [STACK.md](STACK.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [PITFALLS.md](PITFALLS.md).
- Official LiteLLM, New API, Portkey, Helicone, OpenRouter, AIHubMix, and curl docs — comparison and conventional SOCKS DNS semantics; see [FEATURES.md](FEATURES.md).

### Tertiary (LOW confidence)
- Registry metadata for optional third-party SOCKS packages and Undici v8/current release observations — not required for the recommended implementation; see [STACK.md](STACK.md).
- RFC 1928/1929 references and source-fetch checks — protocol context; validate implementation behavior with locked-version wire tests; see [PITFALLS.md](PITFALLS.md).

---
*Research completed: 2026-11-16*
*Ready for roadmap: yes*

# Feature Research

**Domain:** Per-provider egress proxy configuration for a local LLM gateway
**Researched:** 2026-11-16
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Provider-scoped proxy setting with inherited default | Operators need different egress routes for providers with regional, network, or IP-allowlist requirements. LiteLLM documents environment-wide `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY`; New API models a provider as a channel with its own advanced configuration. For CCR, put the override on the existing provider entry and retain the existing global proxy as the unset-field default. | MEDIUM | Candidate config shape: `proxy: "socks5h://user:password@host:port"` or `proxy: "direct"`. Omitted means unchanged existing behavior. The exact property name is a project decision. Do not copy global proxy credentials into each provider. |
| Predictable precedence and explicit direct mode | A configured per-provider choice must win over inherited global/environment/system choices; operators also need a way to bypass all proxies for one provider. | MEDIUM | Document and test the effective selection order. Treat `direct` as an explicit terminal choice, not as “try direct if the configured proxy fails.” For a missing provider setting, preserve the current `proxy.upstream` → environment proxy → system proxy behavior. A proxy failure should surface as an error, not silently leak traffic through direct egress. |
| SOCKS5 and SOCKS5h URL support, including remote DNS | SOCKS support is the feature's core purpose; callers expect `socks5h` to keep target DNS resolution at the proxy instead of leaking or depending on local DNS. | HIGH | SOCKS5 URL parsing and SOCKS negotiation are separate from ordinary HTTP CONNECT support. Support username/password auth. Do not advertise `socks5h` unless the implementation sends the hostname to the proxy for resolution. The distinction follows conventional client semantics (for example, curl distinguishes `--socks5` and `--socks5-hostname`). |
| URL validation and useful connection errors | Invalid schemes, malformed authorities, bad ports, encoding errors, refused connections, auth failures, and handshake timeouts must be diagnosable before or during use. | MEDIUM | Accept only the intended schemes and valid host/port forms; safely parse percent-encoded user/password values. Show actionable error classes/messages without credentials. Distinguish proxy connect/auth/handshake failures from upstream HTTP errors. |
| Bounded proxy connection and request timeouts | A proxy that is down or slow must not stall the gateway or catalog refresh indefinitely. | MEDIUM | Reuse the existing request timeout budget where possible and bound connection/handshake establishment. New API's recent changelog documents per-channel transport controls; Portkey documents outbound request timeout configuration. Avoid adding an uncoordinated timeout surface unless existing controls cannot cover the need. |
| Provider-bound egress consistency | A provider setting is misleading if only chat completions use it while model catalog, probe, or account/token refresh calls bypass it. | HIGH | Apply the effective provider proxy to router upstream attempts, per-provider catalog/probe refresh, and provider token/account endpoints. Keep unrelated egress on the existing global behavior, as scoped in the milestone. |
| Existing provider editor support | This is a local gateway used through config files and a desktop app; both operator surfaces must be able to set and preserve the option. Comparable New API exposes channel settings in its provider/channel editor, while CCR already has a provider editor. | MEDIUM | Add a compact field group to the existing editor, not a second proxy-management screen. Include an explicit Direct choice and an inherited/default state; empty should not ambiguously mean both direct and inherit. |
| Safe proxy credential handling | Proxy credentials are secrets and URLs with credentials can leak through logs, UI, errors, exports, or support diagnostics. | MEDIUM | Permit username/password in the URL as required, but redact userinfo in every display/log/error and avoid including the raw URL in route traces. URL-special characters in credentials need percent encoding. |
| Effective proxy decision in request logs and route trace | When a provider fails, operators need to know which egress path CCR selected, not only which model/provider was attempted. Portkey's logs/traces illustrate the value of exposing the actual target and each fallback attempt. | MEDIUM | Record the selected source (`provider`, `direct`, `global`, `env`, or `system`) and a sanitized proxy endpoint/scheme per attempt. Capture the decision at dispatch time so retries and provider switches are represented accurately. Never log URL credentials. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Trace proxy decision beside each attempt hop | Makes route-trace diagnosis fast when retries, class switches, or fallback providers take different egress paths. | MEDIUM | CCR already has attempt hops and route trace. Add a sanitized `proxySource` / endpoint summary to each hop or equivalent trace detail, rather than creating a parallel tracing system. |
| Lightweight “test proxy” action in the provider editor | Lets an operator detect unreachable proxy/auth configuration before waiting for a model request or catalog refresh. | MEDIUM | Reuse an existing provider connectivity/probe flow where safe. Report connect/auth/remote-DNS outcome and latency; do not add a persistent background health monitor. |
| Display effective source and SOCKS DNS mode in the editor | Reduces confusion between an explicit provider override, inherited global proxy, and `direct`, and clarifies `socks5` versus `socks5h`. | LOW | Show the effective choice with credentials masked. The editor is the right place; no new top-level proxy screen is needed. |
| Per-provider proxy latency in a manual test result | Helps operators compare their own proxy endpoints without automatically changing routing. | LOW | Display a one-off measured connect/probe duration only if the existing probe result can carry it. Do not turn it into automatic latency ranking. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic proxy fail-open to direct egress | “Keep requests working if the proxy is down.” | Can expose provider traffic from an unexpected IP, violate allowlists or geography requirements, and leak DNS or request metadata. It also makes a configured proxy's guarantees false. | Fail with an explicit proxy error. If the operator wants direct egress, configure `direct` deliberately. |
| Proxy per model or per credential | Fine-grained routing may appear flexible. | Adds precedence ambiguity alongside provider credentials, model shelves, and route retries; increases UI and test matrix substantially. | Keep the provider entry as the scope, matching the milestone boundary. |
| Proxy chains, PAC files, SOCKS4, or arbitrary proxy protocols in v1 | Broader compatibility looks attractive. | Expands protocol parsing, authentication, DNS, failover, and security behavior beyond the use case. | Support only `socks5://`, `socks5h://`, and explicit `direct`; use one proxy endpoint per provider. |
| Automatic proxy health monitoring and latency-based proxy selection | Appears to improve reliability and performance. | Requires background traffic, state/retention policy, failover semantics, and a definition of “healthy”; selection can defeat an operator's chosen egress identity. | Provide a manual one-shot test later if demanded; keep routing deterministic. |
| Log full proxy URL or credentials | Makes troubleshooting seem easier. | Leaks secrets into request logs, trace exports, screenshots, and support bundles. | Log source, scheme, sanitized host/port, DNS mode, and typed failure only. |
| Share one mutable global proxy selection across provider attempts | Simpler implementation may seem sufficient. | Concurrent requests and retries can use the wrong provider's dispatcher; probes or account refreshes can silently follow another provider's path. | Resolve an immutable effective proxy from the provider context for each outbound request. |

## Feature Dependencies

```text
Validated provider proxy config (URL | direct | unset)
    └──requires──> Effective proxy resolver and precedence rules
                        └──requires──> SOCKS5 transport with auth + remote DNS
                                            └──requires──> Provider-bound fetch dispatch
                                                                    ├──enhances──> Router attempt hops
                                                                    ├──enhances──> Catalog/probe refresh
                                                                    └──enhances──> Provider account/token requests

Provider editor field ──requires──> Config contract + validation/redaction
Request-log/route-trace visibility ──requires──> Effective proxy metadata at dispatch
Manual proxy test ──requires──> SOCKS transport + safe provider probe path

Explicit direct ──conflicts──> Automatic proxy-failure fail-open
```

### Dependency Notes

- **Provider proxy config requires the effective resolver:** The resolver must distinguish an unset field (inherit existing behavior) from an explicit `direct` value (bypass all proxy layers). Preserve the current behavior for providers with no setting.
- **Effective proxy resolution requires SOCKS transport before feature completion:** Parsing the URL alone is not enough; the dispatcher must actually negotiate SOCKS and implement remote DNS for `socks5h`.
- **Provider-bound egress requires all provider-owned outbound call sites to share resolution:** Upstream attempts, provider catalog/probe refresh, and token/account endpoints must use the same provider context. Unrelated egress remains on global routing.
- **Trace visibility enhances existing attempt hops:** Record the resolved choice per outbound attempt so retries are attributable. Do not infer the selected proxy later from mutable global state.
- **UI and config-file support require one shared representation:** The desktop editor should round-trip the same provider-level setting used by the config file and core contract.
- **Explicit direct conflicts with fail-open:** Direct must be operator-selected, not a hidden fallback after proxy failure.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Provider-level SOCKS5 URL setting with username/password auth and explicit `direct` — required for provider-specific egress.
- [ ] Correct unset/inherit and explicit-direct precedence — preserves today's behavior for existing configs and prevents accidental egress changes.
- [ ] Native SOCKS5 dispatch with proxy-side DNS for `socks5h` — removes the existing HTTP-CONNECT shim limitation and avoids local DNS dependence.
- [ ] Apply the setting to upstream requests, provider catalog/probe refresh, and token/account endpoints — otherwise the feature is inconsistent.
- [ ] Add the setting to config-file and existing provider-editor flows — both are current CCR configuration surfaces.
- [ ] Validate input, bound connection setup, redact credentials, and surface typed failures — minimum operational and security requirements.
- [ ] Record sanitized effective proxy source/endpoint in existing attempt trace and request log — enables diagnosis without secret leakage.

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Manual “test proxy” action — add if users need preflight checks beyond existing provider probes.
- [ ] Show one-shot proxy latency and effective inherited/direct state in the editor — add if support feedback shows configuration ambiguity.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Background proxy health checks or automatic proxy ranking — defer because the operator explicitly selects egress and the milestone excludes health monitoring.
- [ ] Multiple proxies, proxy chains, PAC, or per-model/per-credential overrides — defer unless a concrete need outweighs the larger precedence and security surface.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Per-provider proxy / direct / inherit semantics | HIGH | MEDIUM | P1 |
| SOCKS5 auth and SOCKS5h remote DNS | HIGH | HIGH | P1 |
| Provider-bound dispatch for all provider-owned egress | HIGH | HIGH | P1 |
| Config/editor support and URL validation | HIGH | MEDIUM | P1 |
| Credential redaction and bounded failure reporting | HIGH | MEDIUM | P1 |
| Effective proxy details in existing trace/log | HIGH | MEDIUM | P1 |
| Manual proxy test and latency display | MEDIUM | MEDIUM | P2 |
| Background health checks / ranking | LOW | HIGH | P3 |
| Proxy chains and finer-than-provider scope | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | LiteLLM | New API / one-api family | Portkey / Helicone / OpenRouter / AIHubMix | Our Approach |
|---------|---------|---------------------------|---------------------------------------------|--------------|
| Provider target configuration | `model_list` entries define model, `api_base`, and credentials. Official proxy docs found in this research describe HTTP proxy variables at process scope, not a per-model proxy field. | Provider is a channel with a channel editor, base URL, priority, model mapping, and other advanced fields. Recent changelog also mentions per-channel HTTP transport controls. | Mostly hosted routing or target selection: Helicone documents target URL overrides; OpenRouter exposes provider ordering/fallback controls; AIHubMix client docs show base URLs. These are not directly equivalent to local SOCKS egress. | Add one setting to each CCR provider entry; do not confuse upstream API base URL with the network proxy. |
| Proxy precedence and direct mode | `HTTP_PROXY`, `HTTPS_PROXY`, and `NO_PROXY` are documented as environment-level behavior. | Queried channel documentation did not establish per-channel SOCKS/direct precedence. | Queried materials focus on hosted routing, not a user-controlled per-provider SOCKS proxy. | Provider override wins; `direct` explicitly bypasses; unset preserves existing global → env → system behavior. |
| SOCKS5 DNS and credentials | Not established by the gateway docs reviewed. | Not established by the docs reviewed. | Not established by the docs reviewed. | Support SOCKS5/SOCKS5h with username/password; guarantee proxy-side DNS for `socks5h`. |
| UI and diagnostics | Proxy variables are environment configuration; model setup and admin UI are separate. | Channel editor exposes provider-specific settings, response time, and a manual channel test. | Portkey documents route/attempt traces; hosted products expose routing/logging rather than CCR-style local proxy administration. | Use the existing CCR provider editor and request log/route trace; avoid a separate proxy screen. |

## Sources

- LiteLLM, “SSL, HTTP Proxy Security Settings” — https://docs.litellm.ai/docs/guides/security_settings (official docs; provider: Context7/web fetch; MEDIUM confidence for documented environment-proxy behavior).
- New API, “Channel Management” — https://docs.newapi.ai/en/docs/guide/feature-guide/admin/channel (official docs; provider: Context7/web fetch; MEDIUM confidence for channel editor, channel testing, and listed advanced options).
- New API, changelog — https://docs.newapi.ai/en/docs/guide/wiki/changelog (official docs; Context7 surfaced recent per-channel HTTP transport controls; MEDIUM confidence).
- Portkey, documentation — https://portkey.ai/docs/llms-full.txt (official docs; Context7 surfaced route-attempt tracing and deployment networking settings; MEDIUM confidence).
- Helicone, gateway target URL header — https://docs.helicone.ai/helicone-headers/header-directory (official docs; Context7; MEDIUM confidence).
- OpenRouter, provider routing — https://openrouter.ai/docs (official docs; Context7 surfaced provider ordering, fallback, and latency sorting; MEDIUM confidence).
- AIHubMix, OpenCode integration — https://docs.aihubmix.com/cn/api/Opencode (official docs; Context7 surfaced configurable base URL; MEDIUM confidence).
- curl, man page (`--socks5` and `--socks5-hostname`) — https://curl.se/docs/manpage.html (official reference for the SOCKS5 versus proxy-resolved-hostname distinction; MEDIUM confidence).
- CCR project context and current config contract — `.planning/PROJECT.md` and `packages/core/src/contracts/app.ts` (primary project evidence; HIGH confidence).

---
*Feature research for: per-provider SOCKS5 proxies in Claude Code Router*
*Researched: 2026-11-16*

# Requirements: Claude Code Router — v1.1 Per-provider SOCKS5 proxies

**Defined:** 2026-11-16
**Core Value:** Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.

## v1 Requirements

Requirements for milestone v1.1. Each maps to roadmap phases (4+).

### Config contract

- [ ] **CONFIG-01**: Operator can set a `proxy` field on any provider entry to a `socks5://` or `socks5h://` URL (username/password auth supported) or to the explicit value `direct`
- [ ] **CONFIG-02**: A malformed explicit proxy value is rejected at save/parse time with a clear error — the provider never silently egresses direct or global because its invalid value was treated as absent
- [ ] **CONFIG-03**: A provider without a `proxy` field keeps exactly today's egress resolution (global `proxy.upstream` → env → system) — legacy configs are unchanged
- [ ] **CONFIG-04**: The provider proxy setting survives config save/load round-trips (config storage, `saveConfig` RPC, CLI surface) without loss or mutation

### SOCKS transport

- [ ] **SOCKS-01**: A request to a provider that declares a socks5 proxy connects through a SOCKS5 dispatcher drawn from the existing per-URL dispatcher cache, with username/password auth (RFC 1929)
- [ ] **SOCKS-02**: `socks5h://` values are accepted and normalized at the config boundary; wire-level tests against the locked `undici@7.29.0` prove the hostname reaches the proxy for resolution (DOMAIN address type, no local DNS lookup), including the `api.z.ai` AAAA case
- [ ] **SOCKS-03**: A provider set to `direct` egresses through an explicit undici agent that bypasses the global `proxy.upstream`, env proxies, and the gateway child-process preload — not bare fetch
- [ ] **SOCKS-04**: Proxy handshake and connect are bounded by timeouts; proxy errors fail closed with typed, stage-classified errors; the dispatcher cache is bounded and retired dispatchers are closed

### Provider-bound egress

- [ ] **EGRESS-01**: Router upstream attempts resolve the requested provider's proxy policy per attempt (the executor fetch seam)
- [ ] **EGRESS-02**: Per-provider model catalog refresh, model probes, and bench health probes follow that provider's proxy policy instead of the global path
- [ ] **EGRESS-03**: Core account/token endpoint fetches (account-service) follow that provider's proxy policy
- [ ] **EGRESS-04**: The Electron WebContents browser-session account connector is a documented exception — it keeps the existing path, and the limitation is written where operators configure it

### Trace & safety

- [ ] **TRACE-01**: Each upstream attempt's route trace records the effective egress tier (provider proxy / direct / global) as sanitized metadata in the existing route trace
- [ ] **TRACE-02**: A SOCKS or proxy failure never parks or benches the provider's healthy models — the failure is classified as proxy-stage, not upstream-stage
- [ ] **TRACE-03**: Proxy URLs, usernames, and passwords are redacted from logs, traces, error messages, and the UI in every path

### Provider editor UI

- [ ] **UI-01**: Operator can view and edit the provider proxy setting in the existing provider editor (inherit / direct / socks5 URL) with masked credentials, round-tripped through the config contract
- [ ] **UI-02**: The provider editor shows the effective egress mode for the provider (provider proxy vs global vs direct) and the DNS mode
- [ ] **UI-03**: Operator can run a one-shot proxy test from the provider editor that reports reachability through the configured proxy without burning provider quota

### Compatibility & operations

- [ ] **COMPAT-01**: `CCR_PROVIDER_PROXY=0` disables every per-provider proxy seam — behavior matches the parent and the pre-milestone fork on that path
- [ ] **COMPAT-02**: New proxy code lives in one new `packages/core/src/` directory; parent files receive seam calls only, so a parent merge touches only those call lines
- [ ] **COMPAT-03**: Every CCR-related process or helper started during test/verification runs is killed afterwards (nothing left in memory); helpers run at lowest priority; every system setting changed during the work is recorded with how to revert it

## v2 Requirements

Deferred to a future milestone. Tracked, not in the v1.1 roadmap.

### Proxy operations

- **PROXY-01**: Background proxy health monitoring and automatic ranking or failover between proxies
- **PROXY-02**: Proxy chains and PAC support
- **PROXY-03**: Proxy per credential or per model — finer than the provider entry
- **PROXY-04**: socks4 support
- **PROXY-05**: Per-proxy latency display and history

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| socks4 support | The stack has no socks4 endpoint; socks5/socks5h only |
| Proxy per credential or per model | The provider entry is the unit of egress control |
| Non-provider egress (media, plugins, MCP discovery, hosted web-search) | Not made in a provider's name; stays on the global upstream proxy |
| A second HTTP stack or proxy-chain framework | `undici@7.29.0` already ships SOCKS support; FORK-SEAMS wants the smallest footprint |
| Rewriting the request loop or `fetchWithSystemProxy` | Seam discipline: new module + narrow seam calls, parent merges stay small |
| A new standalone proxy UI screen | One field group in the existing provider editor |
| Silent fallback to direct egress on proxy failure | Privacy and reliability: a failing proxy fails closed and is reported |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONFIG-01 | — | Pending |
| CONFIG-02 | — | Pending |
| CONFIG-03 | — | Pending |
| CONFIG-04 | — | Pending |
| SOCKS-01 | — | Pending |
| SOCKS-02 | — | Pending |
| SOCKS-03 | — | Pending |
| SOCKS-04 | — | Pending |
| EGRESS-01 | — | Pending |
| EGRESS-02 | — | Pending |
| EGRESS-03 | — | Pending |
| EGRESS-04 | — | Pending |
| TRACE-01 | — | Pending |
| TRACE-02 | — | Pending |
| TRACE-03 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| COMPAT-01 | — | Pending |
| COMPAT-02 | — | Pending |
| COMPAT-03 | — | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0
- Unmapped: 21 ⚠️

---
*Requirements defined: 2026-11-16*
*Last updated: 2026-11-16 after initial definition*

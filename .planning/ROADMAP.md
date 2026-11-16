# Roadmap: Claude Code Router

## Milestones

- ✅ **v1.0 Automatic class switch** — Phases 1-3 (shipped 2026-11-15)
- 🚧 **v1.1 Per-provider SOCKS5 proxies** — Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Automatic class switch (Phases 1-3) — SHIPPED 2026-11-15</summary>

- [x] Phase 1: Shelves (3/3 plans) — completed 2026-11-15
- [x] Phase 2: Live choice (4/4 plans) — completed 2026-11-15
- [x] Phase 3: Step-down (4/4 plans) — completed 2026-11-15

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Per-provider SOCKS5 proxies (In Progress)

**Milestone Goal:** Each provider can declare its own SOCKS5 proxy or direct egress; provider-bound outbound traffic follows it, and providers without their own setting keep the global upstream proxy unchanged.

- [ ] **Phase 4: Config and transport foundation** - Per-provider proxy config contract, SOCKS5/socks5h and explicit direct Undici dispatchers, bounded timeouts/cache, and kill switch
- [ ] **Phase 5: Provider-bound egress and trace integration** - Route attempts, catalog/model/bench probes, and account fetches through the provider proxy policy with sanitized trace metadata and proxy-stage failure isolation
- [ ] **Phase 6: Provider editor and acceptance hardening** - Provider editor proxy field group, effective/DNS mode display, one-shot proxy test, FORK-SEAMS boundary check, and process/system hygiene gates

## Phase Details

### Phase 4: Config and transport foundation
**Goal**: Operators can configure per-provider `socks5://`, `socks5h://`, or `direct` egress with strict fail-closed validation, proven proxy-side DNS resolution, explicit direct dispatch, and a kill switch that restores parent behavior.
**Depends on**: Phase 3
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, SOCKS-01, SOCKS-02, SOCKS-03, SOCKS-04, COMPAT-01
**Success Criteria** (what must be TRUE):
  1. Operator can set `proxy` on any provider entry to a `socks5://` or `socks5h://` URL (with optional username/password auth) or to `direct`, and the value survives config save/load round-trips across config storage, the `saveConfig` RPC, and the CLI without loss or mutation; a provider without `proxy` keeps today's `proxy.upstream` → env → system resolution unchanged.
  2. When an operator supplies a malformed explicit `proxy` value on a provider entry, save/parse rejects it with a clear error instead of treating it as absent or silently falling back to direct or global egress.
  3. Provider-aware dispatch connects `socks5://` and `socks5h://` providers through the per-URL SOCKS5 dispatcher cache with RFC 1929 username/password auth and sends the hostname (`DOMAIN` address type, no local DNS lookup — including `api.z.ai` with AAAA records) to the proxy; `direct` providers use an explicit Undici agent that bypasses `proxy.upstream`, env proxies, and the gateway child-process preload.
  4. Proxy handshake and connect obey bounded timeouts, fail closed with typed stage-classified errors, evict and close retired dispatchers in a bounded cache, and setting `CCR_PROVIDER_PROXY=0` disables every per-provider proxy seam so behavior matches the parent and pre-milestone fork.
**Plans**: TBD

### Phase 5: Provider-bound egress and trace integration
**Goal**: All provider-bound core outbound traffic honors the provider's proxy policy, records sanitized egress decisions in the route trace without secrets, and never benches healthy models on proxy-stage failures.
**Depends on**: Phase 4
**Requirements**: EGRESS-01, EGRESS-02, EGRESS-03, EGRESS-04, TRACE-01, TRACE-02, TRACE-03
**Success Criteria** (what must be TRUE):
  1. Upstream router attempts, per-provider model catalog refreshes, model probes, bench health probes, and core `account-service` token/account fetches each resolve and use that provider's configured proxy policy (`socks5`/`socks5h`, `direct`, or inherited global) per call without leaking across concurrent providers or shared catalog walks.
  2. The Electron WebContents browser-session account connector keeps its existing path as a documented exception, and that limitation is written where operators configure browser-session accounts.
  3. Each upstream attempt's route trace records the effective egress tier (`provider proxy`, `direct`, or `global`) as sanitized metadata, and proxy URLs, usernames, and passwords are redacted from logs, traces, error messages, and UI surfaces on every path.
  4. When a SOCKS or proxy connection fails, the error is classified as `proxy-stage` rather than `upstream-stage` and never parks or benches the provider's healthy models or credentials.
**Plans**: TBD

### Phase 6: Provider editor and acceptance hardening
**Goal**: Operators can configure, inspect, and test a provider's proxy setting in the existing provider editor while keeping all new proxy code inside a single core directory behind narrow parent-file seams and clean process/system hygiene.
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, COMPAT-02, COMPAT-03
**Success Criteria** (what must be TRUE):
  1. Operator can view and edit a provider's proxy setting (`inherit` / `direct` / `socks5` or `socks5h` URL) in the existing provider editor with masked credentials, and saving round-trips cleanly through the shared config contract.
  2. Operator can see the provider's effective egress mode (`provider proxy`, `global`, or `direct`) and DNS mode in the provider editor, and can run a one-shot proxy test from the editor that reports reachability through the configured proxy without burning provider quota.
  3. All new proxy code lives in one new `packages/core/src/` directory with narrow seam calls in parent files (FORK-SEAMS discipline), and every CCR or helper process started during verification runs at lowest priority, is killed afterward with nothing left in memory, and has any system setting change documented with its exact revert steps.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Shelves | v1.0 | 3/3 | Complete | 2026-11-15 |
| 2. Live choice | v1.0 | 4/4 | Complete | 2026-11-15 |
| 3. Step-down | v1.0 | 4/4 | Complete | 2026-11-15 |
| 4. Config and transport foundation | v1.1 | 0/TBD | Not started | - |
| 5. Provider-bound egress and trace integration | v1.1 | 0/TBD | Not started | - |
| 6. Provider editor and acceptance hardening | v1.1 | 0/TBD | Not started | - |

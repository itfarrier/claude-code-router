# Architecture Research

**Domain:** Per-provider SOCKS5 egress for an existing local model gateway
**Researched:** 2026-11-16
**Confidence:** HIGH for repository integration points; MEDIUM for the Undici SOCKS API/version behavior

## Standard Architecture

### System Overview

Keep CCR's existing gateway and request loop. Add a provider-aware decision layer next to the current proxy helpers. Provider-bound call sites pass the provider's setting to this layer; requests without an override continue through `fetchWithSystemProxy`.

```text
┌──────────────────────────────────────────────────────────────────┐
│ UI / Config                                                       │
│ Provider editor → window.ccr / management RPC → config.sqlite     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ provider.proxy
┌───────────────────────────────▼──────────────────────────────────┐
│ Provider-bound callers                                            │
│ executor · probe · catalog refresh · account/token endpoints      │
└───────────────────────────────┬──────────────────────────────────┘
                                │ fetchWithProviderProxy(...)
┌───────────────────────────────▼──────────────────────────────────┐
│ packages/core/src/provider-proxy/                                 │
│ validate → resolve override / direct / inherited policy           │
│ SOCKS5 dispatcher factory + private per-URL cache                 │
└───────────────────┬──────────────────────────┬───────────────────┘
                    │ explicit proxy/direct     │ unset
          ┌─────────▼──────────┐      ┌─────────▼──────────────────┐
          │ undici.fetch +     │      │ fetchWithSystemProxy       │
          │ Socks5ProxyAgent / │      │ existing global/system     │
          │ direct Agent       │      │ policy, unchanged          │
          └────────────────────┘      └────────────────────────────┘
                                │ safe decision metadata
┌───────────────────────────────▼──────────────────────────────────┐
│ Existing route trace → request log / network-logs.tsx              │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `GatewayProviderConfig` and parser | Store a validated provider-level setting; preserve absence as “inherit” | Additive type and `parseProviders` field; no database-column migration |
| Provider proxy resolver | Decide explicit SOCKS5, explicit direct, or legacy inheritance for one call | Pure function in the new `provider-proxy/` directory |
| SOCKS dispatcher factory/cache | Reuse undici dispatchers by normalized proxy URL, including auth identity | `Socks5ProxyAgent` for SOCKS and `Agent` for explicit direct; never log cache keys |
| Provider-aware fetch wrapper | Apply the decision without changing legacy `fetchWithSystemProxy` callers | New wrapper delegates unset settings to `fetchWithSystemProxy` |
| Provider call sites | Supply their known provider to the wrapper | Small substitutions at attempt, probe/catalog, and account/token fetches |
| Route trace | Record which policy tier was selected for each upstream attempt | Existing `RequestRouteTraceDecision.source` and `.reason`; omit proxy URL and credentials |
| Provider editor | Let users set SOCKS5 URL or explicit direct in the existing provider form | Extend provider draft load/edit/save and existing `window.ccr` probe request |

## Recommended Project Structure

```text
packages/core/src/provider-proxy/
├── setting.ts          # parse/validate the provider proxy setting
├── resolver.ts         # explicit override vs direct vs inherited policy
├── dispatchers.ts      # Socks5ProxyAgent and direct Agent factories/cache
└── fetch.ts            # fetchWithProviderProxy and safe decision metadata
```

Keep the current `packages/core/src/proxy/system-proxy-fetch.ts` as the legacy/global path. Do not put per-provider selection in `supervisor.ts`, mutate proxy environment variables per request, or change the public signature/behavior of `fetchWithSystemProxy(input, init)`.

### Structure Rationale

- **`provider-proxy/`:** A new `packages/core/src/` directory keeps the feature isolated and follows `.planning/research/FORK-SEAMS.md`; the parent loop remains parent-owned.
- **Existing `proxy/`:** Its `fetchWithSystemProxy` remains the compatibility fallback. Unset provider fields therefore preserve today's behavior.
- **Existing `class-switch/`:** Its catalog code is already fork-owned. Add only the provider setting to its per-provider probe call; do not move or duplicate the catalog walk.
- **UI:** Keep the setting in the current provider add/edit form. Do not add a separate proxy screen.

## Architectural Patterns

### Pattern 1: Add a provider-aware fetch variant; do not widen the old API

**What:** Keep `fetchWithSystemProxy(input, init)` unchanged. Add a wrapper such as `fetchWithProviderProxy(input, providerProxy, init, onDecision?)`. With no `providerProxy`, it delegates to `fetchWithSystemProxy` exactly. With `direct`, it uses an explicit direct dispatcher. With a SOCKS URL, it uses a SOCKS dispatcher.

**When to use:** At a call site that has the actual `GatewayProviderConfig` (or the unsaved provider draft).

**Trade-offs:** The call site must pass provider context. That is preferable to ambient request-global state, which is unsafe when concurrent requests target different providers.

```typescript
// Illustrative API only; keep the existing fetchWithSystemProxy signature intact.
await fetchWithProviderProxy(
  attemptUrl,
  attempt.target?.kind === "provider" ? attempt.target.provider.proxy : undefined,
  init,
  (decision) => traceProviderProxyDecision(input.trace, attemptNumber, attemptProvider, decision)
);
```

### Pattern 2: Use the SOCKS dispatcher already in the locked Undici version

**What:** The repository locks `undici@7.29.0`. Its official API documents `Socks5ProxyAgent` as a `Dispatcher` for `fetch`, with username/password auth and domain-name destinations. The docs list `socks5://` and `socks://`, not `socks5h://`; validate both accepted config schemes, then normalize `socks5h:` to the agent's supported `socks5:` URL form. Undici's SOCKS implementation sends domain targets to the proxy for DNS resolution, matching the milestone's remote-DNS requirement.

Use `undici.fetch` together with the dispatcher constructed by the same installed `undici` package. Do not pair a bundled Undici dispatcher with an unrelated Node global `fetch`: `supervisor.ts` documents the Undici-major mismatch risk for Node >=25.

**When to use:** For explicit provider SOCKS or direct mode. Leave the inherited path on the current `fetchWithSystemProxy` implementation.

**Trade-offs:** Native Undici support avoids a custom SOCKS connector and an HTTP-CONNECT shim. Pin/verify behavior against the lockfile version, because `socks5h:` itself is not the documented constructor scheme.

### Pattern 3: Resolve and report the policy once per provider-bound call

**What:** Have the resolver return both the dispatcher/fetch path and a small safe decision record. Use the same result for dispatch and trace; do not independently recompute what the trace says.

**When to use:** Upstream attempts, model probes, catalog walks, and account/token requests.

**Trade-offs:** For a provider with no override, record that CCR delegated to the legacy global policy. Do not claim that it selected a specific environment/system endpoint unless the existing resolver can identify that source without duplicating its policy.

## Data Flow

### Request Flow

```text
Incoming request
    ↓
Routing produces UpstreamAttempt (provider is known here)
    ↓
executor.ts resolves provider.proxy
    ├─ socks5:// or socks5h:// → cached Socks5ProxyAgent → undici.fetch
    ├─ direct                  → cached direct Agent → undici.fetch
    └─ absent                  → existing fetchWithSystemProxy
    ↓
Capture safe decision on the attempt's route trace
    ↓
Existing upstream response / retry loop continues unchanged
```

### State Management

```text
Provider config in config.sqlite JSON blob
    ↓ loadAppConfig → parseProviders + validation
Provider editor draft ↔ existing window.ccr probe/config APIs
    ↓
Saved provider.proxy is read by executor, probes, refreshers, and account service
```

### Key Data Flows

1. **Gateway request:** At `executor.ts` near the current `fetchWithSystemProxy` call, `attempt.target.provider` is available. Resolve once for each attempt, so retries to a different provider use that provider's own route.
2. **Probe and model catalog:** Carry the setting through `GatewayProviderProbeRequest` and the candidate request. `requestJson` is the shared network boundary in `providers/probe.ts`; thread the setting to it and to probe-time OAuth token refresh.
3. **Periodic model and health probes:** In `class-switch/catalog.ts`, `refreshClassShelves` calls `probeGatewayProvider` once per enabled provider. Pass that provider's setting there. Also pass it from `providers/model-auto-refresh.ts` for `autoFetchModels` and from `class-switch/bench.ts` for scheduled per-provider connectivity/recovery probes.
4. **Account/token:** `account-service.ts` already has the provider in `fetchJson`; pass its setting to the wrapper. Thread the provider to `refreshCodexAccountToken`, which currently receives only OAuth config and refresh token, so token refresh uses the same provider route.

## Integration Points and Required Changes

| File + symbol | Change | Boundary |
|---------------|--------|----------|
| `packages/core/src/contracts/app.ts` — `GatewayProviderConfig` | Add optional `proxy` setting (`direct` or SOCKS URL). Add the same optional setting to probe request/candidate request types where needed. | Small additive contract edit |
| `packages/core/src/config/config.ts` — `parseProviders` | Parse and validate `item.proxy`; do not silently drop invalid explicit values, because that could unexpectedly send credentials through the global route. | Small additive parser edit |
| `packages/core/src/proxy/system-proxy-fetch.ts` — `fetchWithSystemProxy` | Keep signature and behavior unchanged. The new wrapper delegates here only when the provider setting is absent. | No required edit |
| `packages/core/src/provider-proxy/*` — new | Implement validation, resolution, dispatcher factory/cache, fetch wrapper, decision types, and `CCR_PROVIDER_PROXY=0` behavior. | Fork-owned directory |
| `packages/core/src/gateway/upstream/executor.ts` — `fetchUpstreamWithFallback` attempt fetch near line 549 | Replace only the fetch call with the provider-aware variant; provider is `attempt.target.provider`. Preserve retry loop and `UpstreamAttempt`. Add a trace decision for this attempt. | One seam call at the existing fetch boundary |
| `packages/core/src/providers/probe.ts` — `probeGatewayProvider`, `resolveGatewayProviderProbe`, `requestJson` | Thread the optional setting through model/protocol fetches and probe OAuth refresh. Include a one-way hash of the setting in the probe cache/in-flight key so a changed proxy cannot reuse a result from another egress route. | Narrow fetch-boundary seam |
| `packages/core/src/class-switch/catalog.ts` — `refreshClassShelves` provider loop | Pass `provider.proxy` to that provider's `probeGatewayProvider` call. Keep the 10-minute cadence and serialized walk. | Fork-owned existing directory |
| `packages/core/src/providers/model-auto-refresh.ts` — `refreshAutoFetchProviderModels` | Pass each provider's setting to its model probe. Keep the current `providerModelAutoRefreshIntervalMs` (10 minutes). | One additive call argument |
| `packages/core/src/class-switch/bench.ts` — `runBenchProbeTick` | Pass the resolved provider's setting to the scheduled connectivity probe. This probe is provider-bound even though it is separate from catalog refresh. | Fork-owned existing directory |
| `packages/core/src/providers/account-service.ts` — `fetchJson`, `refreshCodexAccountToken` | Use the provider-aware variant for provider account endpoints and token refresh. Thread provider context into the token refresh helper. | Narrow fetch-boundary seams |
| `packages/ui/src/pages/home/shared/types.ts` — `AddProviderDraft`; `shared/providers.ts` — `createProviderDraft`, `createProviderDraftFromProvider` | Carry the setting into new/edit drafts. | UI state seam |
| `packages/ui/src/pages/home/components/providers.tsx` — `AddProviderForm` | Add one proxy field group to the existing provider editor (available for presets and custom providers), with `direct` or a `socks5://` / `socks5h://` URL. Treat it as secret-bearing input; never display it in diagnostic text. | Existing UI, no new screen |
| `packages/ui/src/pages/home/App.tsx` — provider probe/save flow | Include the draft setting in provider probes and save it on the provider object. Changing the setting invalidates cached UI probe state. | Existing `window.ccr` flow |
| `packages/electron/src/main/preload.ts`, `packages/electron/src/main/ipc.ts`, `packages/ui/src/types/electron.d.ts`, `packages/core/src/web/management-server.ts` | Extend the existing typed probe request payload; no new IPC channel is needed. Management RPC already forwards the request. | Only if type propagation requires it |
| `packages/ui/src/pages/home/components/network-logs.tsx` — `routeHopDisplayName` / `LogRouteHopDetails` | Give the proxy decision hop a readable label. The existing decision renderer displays `source` and `reason`. | Small log UI seam |
| `packages/electron/src/main/provider-account-webcontent.ts` — `createProviderAccountWebContentFetchHandler` | Separate design decision for browser-session account fetches; it executes `fetch` in a WebContents context and uses a shared persistent session. See the caveat below. | Do not silently claim this path is covered |

### Config and Compatibility

Use `provider.proxy` as the provider-level key. The accepted values are exactly `direct`, `socks5://...`, and `socks5h://...`; the runtime parser must reject other schemes, missing proxy hosts/ports, or malformed credentials. Define the type in `contracts/app.ts`, and preserve it in `parseProviders`.

`config.sqlite` stores the app config as a JSON blob (`app_config.value_json`), not one SQL column per provider field. Old entries without `proxy` therefore remain valid and mean “inherit”; no SQL migration is needed. Saving an edited provider must preserve the field through `createProviderDraftFromProvider` and the provider save object in `App.tsx`.

`direct` is an explicit override: it must bypass provider/global/environment/system proxies. In the managed gateway process, `supervisor.ts` sets `CCR_UPSTREAM_PROXY_URL` and `gatewayFetchPreloadScript()` patches global fetch for legacy/global traffic. A bare `fetch()` is therefore not a safe direct override. Use a direct Undici `Agent` passed to the package's own `undici.fetch`. Do not change child-process environment variables per request; concurrent provider requests share that process.

When `proxy` is absent, delegate to the existing global resolver. Preserve its exact semantics: `fetchWithSystemProxy` reads `proxy.upstream`; in system mode it checks the managed/system proxy and then environment proxy. The milestone's summarized chain lists environment before system, so that ordering differs from the current implementation; do not change inherited behavior as part of this feature. Decide separately if the global order should change. Interpret the chain as configuration precedence, not failover after a SOCKS connection error: an explicitly selected but unavailable provider proxy should fail, not silently downgrade to direct or global egress.

### Catalog Walk and Probe Behavior

The class-switch catalog performs a per-provider model probe in `refreshClassShelves` and schedules the next pass using `providerModelAutoRefreshIntervalMs` (10 minutes). The separate `autoFetchModels` walk also uses the same 10-minute constant. Both loops must pass each provider's setting into `probeGatewayProvider`; each iteration must resolve its own dispatcher. `class-switch/bench.ts` also makes scheduled connectivity probes by provider and must pass the same setting. This prevents one provider's route from bleeding into the next provider's request.

Keep the shared OpenRouter score/catalog request in `fetchOpenRouterScoreRows` on the global/non-provider path: it is not a provider's model endpoint. Do not alter the refresh cadence, consolidate the walks, or assign the last provider's proxy to a shared global fetch.

The editor's connectivity/model probes also need the draft's setting, including `probeGatewayProviderCandidates`. A probe cache key must distinguish settings without embedding raw credentials; hash the normalized setting, and do not log the raw request.

### Route Trace and Credential Safety

Record one decision per upstream attempt, alongside or immediately before `upstream.attempt.prepare`. Use existing `RequestRouteTraceDecision` fields, for example:

| Decision | Safe trace value |
|----------|------------------|
| Explicit SOCKS setting | `source: "provider-proxy"`; reason: `"SOCKS5 remote-DNS override"` |
| Explicit direct | `source: "provider-direct"`; reason: `"provider selected direct egress"` |
| No provider setting | `source: "legacy-proxy-policy"`; reason: `"provider override absent; delegated to fetchWithSystemProxy"` |

Do not put the SOCKS URL, username, password, URL user-info, proxy authorization, or serialized dispatcher options in `target`, `reason`, diagnostics, error messages, or request logs. Do not include the raw proxy URL in trace changes. A proxy host/port is not necessary for the milestone; if later required for support, emit only a separately sanitized host/port with explicit privacy review. No new user-facing class-switch notice is needed; use the existing route trace/request log.

Undici's SOCKS5 username/password authentication is not encrypted by plain SOCKS5. The UI should mask credentials where practical, config/error diagnostics must redact them, and operators should use a trusted proxy network.

### Browser-Session Account Endpoint Caveat

`account-service.ts` can use the core dispatcher directly. The browser-session connector is different: `account-webcontent.ts` delegates to Electron, and `provider-account-webcontent.ts` runs `fetch()` inside a WebContents with `credentials` and a shared `persist:ccr-built-in-browser` session. A per-request core dispatcher cannot simply be injected into that browser fetch, and changing the shared Electron session proxy can affect unrelated browser/account traffic.

Before claiming every account connector follows the provider proxy, decide between a provider-isolated Electron session/proxy arrangement and a main-process request path that safely transfers the required browser cookies/storage-derived headers. If neither is acceptable for this milestone, explicitly scope browser-session account connectors as an exception and document it. This is the main phase-specific feasibility item.

## Build Order and FORK-SEAMS Discipline

1. **Lock the config contract.** Add the optional provider setting and probe-request type, strict parser/validation tests, and absent-field compatibility tests. Do not add a database migration or a global config key.
2. **Build the isolated runtime.** Add `packages/core/src/provider-proxy/`: setting validator, resolution policy, Undici SOCKS/direct dispatcher factory, cache, and provider-aware fetch wrapper. Use the existing `undici@7.29.0` `Socks5ProxyAgent`; normalize `socks5h:` to supported `socks5:` while retaining remote DNS behavior. Add `CCR_PROVIDER_PROXY=0`; off means ignore all provider overrides and delegate to `fetchWithSystemProxy`.
3. **Prove dispatch semantics before call-site expansion.** Test authenticated SOCKS, remote DNS (a domain target is sent to the proxy), HTTPS tunnel, direct bypass despite inherited `CCR_UPSTREAM_PROXY_URL`, absent-setting legacy behavior, malformed URL rejection, cache-key separation for different credentials, and no credential-bearing logs. Pair Undici dispatchers with that same Undici package's `fetch`.
4. **Wire the live request seam and trace.** Change only the fetch boundary in `gateway/upstream/executor.ts`; retain attempt/retry behavior. Emit the safe decision record and add the readable label in `network-logs.tsx`. Verify every retry attempt uses its own target provider.
5. **Wire provider probes and refresh walks.** Thread the setting through `probe.ts` and its one `requestJson` boundary, probe OAuth refresh, UI candidate probes, `class-switch/catalog.ts`, `class-switch/bench.ts`, and `model-auto-refresh.ts`. Verify the 10-minute loops remain unchanged and OpenRouter score retrieval stays provider-agnostic.
6. **Wire account/token requests and close the browser-session gap.** Update `account-service.ts` standard/account and OAuth token calls. Make and test an explicit decision for the Electron WebContents account path before reporting complete provider-bound account coverage.
7. **Finish the editor and end-to-end compatibility check.** Add draft load/edit/probe/save handling and the single field group in the existing provider editor. Run with `CCR_PROVIDER_PROXY=0` and verify behavior matches the prior global path; run with it enabled for SOCKS, direct, inherited provider, and two providers with different proxies. Confirm route logs contain only safe decision labels.

### Parent seam allowlist

Keep all resolver, validation, cache, dispatcher, and wrapper implementation in the new `provider-proxy/` directory. Parent-owned edits should be limited to the call/type seams listed above: `contracts/app.ts`, `config/config.ts`, `gateway/upstream/executor.ts`, `providers/probe.ts`, `providers/model-auto-refresh.ts`, `providers/account-service.ts`, and the existing UI/request-type bridge. `class-switch/catalog.ts` and `class-switch/bench.ts` are already fork-owned. Do not rewrite the request loop, change `credential-pool.ts`, or modify `supervisor.ts`/the preload patch to carry per-request settings. The kill switch is `CCR_PROVIDER_PROXY=0`, not a new app-config setting.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| One local gateway process | One dispatcher cache keyed by normalized proxy URL and auth identity; provider-level selection is per call |
| Many configured providers | Keep the cache bounded and close stale dispatchers when settings change or the runtime stops; avoid an unbounded credential-bearing key map |
| Multiple gateway processes | Each child owns its own cache and config snapshot; no shared mutable proxy environment or cross-process dispatcher state |

## Anti-Patterns

### Anti-Pattern 1: Mutating process proxy environment for each provider

**What people do:** Set `HTTPS_PROXY` or `CCR_UPSTREAM_PROXY_URL` before a provider request and restore it later.

**Why it's wrong:** Requests are concurrent in the same gateway process. A request to provider B can observe provider A's environment, and the preload policy is process-global.

**Do this instead:** Pass a provider-selected Undici dispatcher explicitly for each request.

### Anti-Pattern 2: Treating `direct` as “no dispatcher”

**What people do:** Call plain/global `fetch()` to bypass a provider proxy.

**Why it's wrong:** The managed child preload can apply the inherited upstream proxy to calls without an explicit dispatcher.

**Do this instead:** Use an explicit direct `Agent` with the matching `undici.fetch`.

### Anti-Pattern 3: Logging the proxy URL to explain routing

**What people do:** Put the configured URL in route trace or error strings.

**Why it's wrong:** URLs can contain username/password auth and are persisted in request logs.

**Do this instead:** Record only the policy tier and transport label; redact user-info in all validation failures.

### Anti-Pattern 4: Replacing the catalog's shared fetch with the current provider's proxy

**What people do:** Route shared score/catalog retrieval through whichever provider was processed last.

**Why it's wrong:** That request has no provider owner and can use the wrong egress or leak state between refresh iterations.

**Do this instead:** Apply `provider.proxy` only to each provider's probe/model endpoint; keep shared catalog data on the existing global path.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Provider API/model-list endpoint | `probeGatewayProvider` → shared `requestJson` → provider-aware fetch | Per-provider setting; include setting fingerprint in probe cache key |
| SOCKS5 proxy | `undici.Socks5ProxyAgent` as the `fetch` dispatcher | `undici@7.29.0` docs support auth and domain-name targets; normalize `socks5h:` to `socks5:` for the agent |
| Global/system proxy | Existing `fetchWithSystemProxy` | Used unchanged when the provider field is absent |
| Shared OpenRouter model scores | Existing global fetch in `class-switch/catalog.ts` | Not owned by a provider; do not route using a loop-local provider |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Provider config ↔ proxy resolver | Typed `provider.proxy` value | `undefined` inherits; `direct` overrides; SOCKS schemes are validated |
| Gateway executor ↔ provider proxy module | `fetchWithProviderProxy` call at the existing attempt fetch | Provider comes from `attempt.target.provider`; retry plan stays unchanged |
| Probe/catalog ↔ provider proxy module | Optional proxy field on existing probe request | Thread through `requestJson`, OAuth refresh, and each catalog iteration |
| Account service ↔ provider proxy module | Provider object already available for account fetches | Thread it into token refresh helpers that currently only receive OAuth fields |
| UI ↔ core | Existing `window.ccr`/Electron IPC and management RPC request types | Extend payload types; no standalone proxy service/screen |
| Core ↔ request log | Existing route-trace decision fields | Record safe tier/transport only; no credentials or raw proxy URL |

## Sources

- Repository integration and merge constraints: `.planning/research/FORK-SEAMS.md`, `.planning/PROJECT.md` (HIGH; project-owned design and current source).
- Current fetch behavior: `packages/core/src/proxy/system-proxy-fetch.ts`, `packages/core/src/gateway/core-runtime/supervisor.ts` (`createGatewayProcessEnv`, `gatewayFetchPreloadScript`), and `packages/core/src/gateway/upstream/executor.ts` (HIGH; inspected implementation).
- Current provider probes and refresh cadence: `packages/core/src/providers/probe.ts`, `packages/core/src/providers/model-auto-refresh.ts`, `packages/core/src/class-switch/catalog.ts` (HIGH; inspected implementation).
- Undici SOCKS5 API for the locked version: [Undici v7.29.0 `Socks5ProxyAgent` docs](https://github.com/nodejs/undici/blob/v7.29.0/docs/docs/api/Socks5ProxyAgent.md) and [Undici v7.29.0 `ProxyAgent` docs](https://github.com/nodejs/undici/blob/v7.29.0/docs/docs/api/ProxyAgent.md) (MEDIUM; exact upstream version docs cross-checked with Context7; verify in implementation tests).
- Node fetch dispatcher contract: [Node.js fetch documentation](https://nodejs.org/api/globals.html#fetch) (MEDIUM; Node documents custom dispatchers; CCR's gateway preload also documents the runtime-version pairing concern).

---
*Architecture research for: per-provider SOCKS5 proxies in Claude Code Router*
*Researched: 2026-11-16*

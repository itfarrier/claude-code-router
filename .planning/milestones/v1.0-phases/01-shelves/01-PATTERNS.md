# Phase 1: Shelves - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 9 (3 new source, 3 new tests, 3 parent edits)
**Analogs found:** 9 / 9

New code only in `packages/core/src/class-switch/{catalog,plan,seam}.ts`. Tests only in `packages/core/test/unit/class-switch/`. Parent edits only: the end of `createRouteExecutionPlan`, `start`/`stop` beside the existing auto-refresh calls in `startConfiguredServices` / `stopConfiguredServices`, and the end of `createGatewayModelsResponse`. Parent files import `seam.ts` only. `seam.ts` calls `catalog.ts` and `plan.ts`. Do not create `bench.ts` or `notice.ts`.

The score cuts, tier tokens, `:batch` rule, and review-queue distance have no function in this repo. Those rules stay the RESEARCH.md Pattern 4 formula. Everything around them (timer, probe, atomic file, attempt list, `/v1/models` object, test shape) copies a tracked file below.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/class-switch/catalog.ts` | service | batch + file-I/O | `packages/core/src/providers/model-auto-refresh.ts` (timer, probe, keep-on-failure); write/fetch from `packages/core/src/models/catalog-file.ts` | role-match |
| `packages/core/src/class-switch/plan.ts` | service | transform | `packages/core/src/routing/execution-plan.ts` | exact |
| `packages/core/src/class-switch/seam.ts` | utility | request-response | `packages/core/src/runtime/desktop-app.ts` (env equality only) | role-match |
| `packages/core/src/routing/execution-plan.ts` | service | transform | this file | exact (in-place) |
| `packages/core/src/web/management-server.ts` | service | event-driven | this file | exact (in-place) |
| `packages/core/src/gateway/features/model-discovery.ts` | controller | request-response | this file | exact (in-place) |
| `packages/core/test/unit/class-switch/classify.test.mjs` | test | transform + batch | `packages/core/test/unit/usage/usage-normalization.test.mjs` (pure); probe injection from `packages/core/test/unit/providers/provider-model-auto-refresh.test.mjs` | role-match |
| `packages/core/test/unit/class-switch/plan.test.mjs` | test | transform | `packages/core/test/unit/gateway/routing-architecture.test.mjs` | exact |
| `packages/core/test/unit/class-switch/context-window.test.mjs` | test | request-response | `packages/core/test/unit/agents/claude-app-gateway-models.test.mjs` | exact |

`git ls-files` prints every analog path above. None is a gitignored mirror.

## Pattern Assignments

### `packages/core/src/class-switch/catalog.ts` (service, batch + file-I/O)

**Analog:** `packages/core/src/providers/model-auto-refresh.ts` for the walk and timer. `packages/core/src/models/catalog-file.ts` for the snapshot file and the OpenRouter GET.

**Imports pattern** (`model-auto-refresh.ts` lines 1-16, `catalog-file.ts` lines 1-5): source imports use `@ccr/core/...` and no `.ts` suffix. Domain shapes are `export type`, not `interface`.

```typescript
import { loadAppConfig, saveAppConfig } from "@ccr/core/config/config";
import {
  isGatewayProviderEnabled,
  type AppConfig,
  type GatewayProviderConfig
} from "@ccr/core/contracts/app";
import { probeGatewayProvider } from "@ccr/core/providers/probe";
```

```typescript
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";
```

Do not import `saveAppConfig`. The shelf walk does not write `config.json`.

**Timer pattern** (`model-auto-refresh.ts` lines 25, 54-57, 63-87, 388-406): one module-level `setTimeout`, `unref()`, cleared on stop. First delay is `0`, then `providerModelAutoRefreshIntervalMs`. Import that constant. Do not edit `model-auto-refresh.ts`. Do not add a cron package.

```typescript
export const providerModelAutoRefreshIntervalMs = 10 * 60 * 1000;

let autoRefreshTimer: ReturnType<typeof setTimeout> | undefined;
let autoRefreshEnabled = false;

export function stopProviderModelAutoRefreshService(): void {
  autoRefreshEnabled = false;
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
    autoRefreshTimer = undefined;
  }
}

function scheduleProviderModelAutoRefresh(delayMs: number): void {
  if (!autoRefreshEnabled) {
    return;
  }
  if (autoRefreshTimer) {
    clearTimeout(autoRefreshTimer);
  }
  autoRefreshTimer = setTimeout(() => {
    autoRefreshTimer = undefined;
    void runProviderModelAutoRefreshNow().catch((error) => {
      autoRefreshRuntimeOptions.logger?.warn?.(`[providers] Auto model refresh failed: ${formatError(error)}`);
    }).finally(() => {
      if (autoRefreshEnabled) {
        scheduleProviderModelAutoRefresh(providerModelAutoRefreshIntervalMs);
      }
    });
  }, delayMs);
  autoRefreshTimer.unref?.();
}
```

`seam.start()` sets the enabled flag and calls `schedule(0)` only when `process.env.CCR_CLASS_SWITCH !== "0"`. When the switch is `"0"`, `start` does not schedule and does not fetch. `seam.stop()` is the `stopProviderModelAutoRefreshService` shape.

**Injectable run-once pattern** (`model-auto-refresh.ts` lines 43-46, 106-110): tests must not hit the network. Export one run-once function that takes options. Default the probe to `probeGatewayProvider`. Default the score GET to global `fetch`. `catalog-file.ts` calls `fetch` directly and is the wrong shape for a test double.

```typescript
export type ProviderModelAutoRefreshOptions = {
  logger?: Pick<Console, "warn">;
  probeProvider?: ProviderModelProbe;
};

export async function refreshAutoFetchProviderModels(
  config: AppConfig,
  options: ProviderModelAutoRefreshOptions = {}
): Promise<ProviderModelAutoRefreshResult> {
  const probeProvider = options.probeProvider ?? probeGatewayProvider;
```

**Which providers** (`model-auto-refresh.ts` lines 115-142 and 408-410, `contracts/app.ts` lines 189-191): copy the base-URL skip and the `probeGatewayProvider` argument object. Drop the `autoFetchModels` guard. A provider is in the walk when `isGatewayProviderEnabled(provider)` is true and `provider.api_base_url || provider.baseUrl || provider.baseurl` is non-empty.

```typescript
export function isGatewayProviderEnabled(provider: Pick<GatewayProviderConfig, "enabled">): boolean {
  return provider.enabled !== false;
}
```

```typescript
const probe = await probeProvider({
  apiKey: providerApiKeyForModelRefresh(provider),
  baseUrl,
  forceRefresh: true,
  mode: "models",
  models: provider.models,
  providerPlugins: providerPluginsForModelRefresh(config, provider),
  protocols: providerModelRefreshProtocols(provider)
});
```

`GatewayProviderProbeRequest.mode` is `"connectivity" | "models" | "protocols"` (`contracts/app.ts` lines 577-586). `mode: "models"` lists models. `mode: "connectivity"` is the chat ping. Never pass `"connectivity"`.

`probe.ts` lines 353-355 run `probeModels` only when `mode === "models"`. Lines 685-699 call `probeProtocolConnectivity` only when `mode === "connectivity"`. The ping body is lines 819-832 (`messages: [{ content: "ping", role: "user" }]`). `mode: "models"` still POSTs `{}` for chat protocol support (`probe.ts` lines 884-910). Tests reject a body that contains `"ping"`. They do not reject that empty POST.

Read ids from `probe.models` only. `parseModelList` (`probe.ts` lines 1598-1614) keeps the id and the display name. It drops `context_length` and `benchmarks`. Do not parse the probe payload for scores or windows.

On throw, copy the catch (`model-auto-refresh.ts` lines 171-179): log `formatError` (lines 718-720) and keep that provider's previous id list. Do not remove names from `provider.models`. Do not call `saveAppConfig`.

**OpenRouter GET** (`catalog-file.ts` lines 42-65): one `GET https://openrouter.ai/api/v1/models`, `accept: application/json`, no body, `AbortSignal.timeout(10_000)`. On any failure, including a non-OK status, keep the previous score table. Do not empty shelves. `catalog-file.ts` already does that with `console.warn` and a swallowed error (lines 63-65).

```typescript
const response = await fetch(url, {
  headers: { accept: "application/json", "cache-control": "no-cache" },
  signal: AbortSignal.timeout(10_000)
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
```

On HTTP 401, retry once with the API key of an enabled provider whose base URL host is `openrouter.ai`. Header shape is `probe.ts` lines 1570-1577. Do not log that header. Do not add a config key.

```typescript
function authorizationHeaders(apiKey: string | undefined): Record<string, string> {
  const trimmed = apiKey?.trim();
  if (!trimmed) {
    return {};
  }
  return {
    authorization: /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`
  };
}
```

**Snapshot path and atomic write** (`catalog-file.ts` lines 23-25 and 54-62, `app-paths.ts` lines 44-53): same directory as `models.json`. Filename `class-switch-shelves.json`. `resolveRuntimeDataDir()` reads `CCR_INTERNAL_USER_DATA_DIR` (`app-paths.ts` lines 7-9 and 55-62). The gateway child copies `process.env`, so the same path works in the child.

```typescript
export function modelCatalogCachePath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "models.json");
}
```

```typescript
const file = modelCatalogCachePath();
const temporaryFile = `${file}.${randomUUID()}.tmp`;
try {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(temporaryFile, JSON.stringify(payload), "utf8");
  await rename(temporaryFile, file);
} finally {
  await rm(temporaryFile, { force: true });
}
```

`loadModelCatalogPayload` (`catalog-file.ts` lines 81-89) does `JSON.parse` with no catch. The shelf reader must catch. A missing or invalid file means no shelf. The request path returns the parent plan. It does not throw.

Snapshot types are the RESEARCH.md Pattern 7 `ShelfClass` / `ShelfRow` / `ShelfSnapshot` block. `export type` only. The file stores provider name, model id, score, tier, window, and reason. It does not store API keys.

Before the first successful fetch, classify `provider.models` so a class request works at startup. The first tick still runs at delay 0. A name absent from the latest successful fetch for that provider leaves the shelves. A failed fetch keeps the previous ids.

**Classifier:** no analog. Put `scoreArtificialAnalysis` and `classForScore` in this file, as RESEARCH.md Pattern 4 writes them. A present index is `Number.isFinite`. `null` is missing. Cap one index to Sonnet before the distance check. Shelf the score class when the distance is 0 or 1. Distance greater than 1 is `review`, not a shelf. Export the classifier so `classify.test.mjs` calls it with the inline fixtures. Those tests must not `fetch` OpenRouter.

**Context window number:** `effectiveProviderContextWindow` is private in `model-discovery.ts` (lines 420-427). Do not export it and do not edit that function. Copy those lines once into `catalog.ts`, calling the exported `effectiveContextWindowPercentFor` (`contracts/app.ts` lines 246-254) and the same `positiveInteger` check (`model-discovery.ts` lines 491-495). `plan.ts` and `seam.ts` call this one function.

```typescript
function effectiveProviderContextWindow(metadata: ProviderModelMetadata | undefined): number | undefined {
  const contextWindow = positiveInteger(metadata?.contextWindow) ?? positiveInteger(metadata?.maxContextWindow);
  if (!contextWindow) {
    return undefined;
  }
  const effectivePercent = effectiveContextWindowPercentFor(metadata) ?? 100;
  return Math.max(1, Math.floor((contextWindow * effectivePercent) / 100));
}
```

Order, first match wins:

1. That metadata window.
2. `modelCatalogMaxInputTokens(findProviderModelCatalogEntry(...))`, else `findModelCatalogEntry`, only when the number is `> 0` (`model-catalog.ts` lines 56-58, 80-84, 156-162).
3. Matched OpenRouter `context_length`, else `top_provider.context_length`, when it is a positive finite number.

Do not call `claudeCodeEffectiveMaxInputTokens` (`model-catalog.ts` lines 164-169). Do not use `claudeCodeUnknownModelDefaultContextWindow` (`model-discovery.ts` line 291). Do not write `200000` or `1000000` when the window is unknown.

**Error handling:** per-provider `try/catch` like `model-auto-refresh.ts` lines 133-179. Score-GET `try/catch` like `catalog-file.ts` lines 44-65. Neither path clears a previous good snapshot.

---

### `packages/core/src/class-switch/plan.ts` (service, transform)

**Analog:** `packages/core/src/routing/execution-plan.ts`. Class-name decode is a call into `packages/core/src/agents/claude-app/gateway-routes.ts`, not a second parser.

**Imports pattern** (`execution-plan.ts` lines 1-6):

```typescript
import {
  ROUTER_FALLBACK_MAX_RETRY_COUNT,
  type RouterFallbackConfig
} from "@ccr/core/contracts/app";
import type { RouteExecutionPlan } from "@ccr/core/routing/contracts";
import { type ModelRegistry, normalizeRouteSelector } from "@ccr/core/routing/model-registry";
```

`plan.ts` also imports `decodeClaudeAppGatewayRouteId` and `stripClaudeAppGatewayOneMillionContextSuffix` from `@ccr/core/agents/claude-app/gateway-routes`. Do not copy the hex regex.

**Core pattern** (`execution-plan.ts` lines 8-55, `contracts.ts` lines 66-76): the parent builds a `RouteExecutionPlan`. The seam replaces `attempts` only. Each attempt is `{ index, model?, target? }`. `routeAttempt` already calls `modelRegistry.resolve(model)` and attaches `target` when resolve returns.

```typescript
function routeAttempt(index: number, model: string | undefined, modelRegistry: ModelRegistry | undefined) {
  const target = modelRegistry?.resolve(model);
  return {
    index,
    model,
    ...(target ? { target } : {})
  };
}
```

```typescript
export type RouteAttemptPlan = {
  index: number;
  model?: string;
  target?: RouteModelRef;
};
```

The attempt `model` string is the registry selector `` `${provider.name}/${model}` ``. That is `providerModelRef` (`model-registry.ts` lines 213-221). Pass that whole string to `resolve`. Do not split a model id on `/` to classify it. `parseProviderModelSelector` (`model-registry.ts` lines 180-192) is for registry lookup, not for the class test.

```typescript
function providerModelRef(provider: GatewayProviderConfig, model: string, selector: string): RouteModelRef {
  return {
    canonicalSelector: `${provider.name}/${model}`,
    kind: "provider",
    model,
    provider,
    selector
  };
}
```

Skip a shelf row when `resolve` does not return `kind: "provider"` (`model-registry.ts` lines 25-73 can also return `kind: "gateway"`). If no provider target remains, return the parent plan. Do not return `attempts: []`.

Do not add fields to `RouteAttemptPlan` or to `UpstreamAttempt` (`gateway/internal/shared.ts` lines 182-192).

**Class name** (`gateway-routes.ts` lines 129-131 and 319-332): trim, then if `decodeClaudeAppGatewayRouteId` returns a string, replace the name with that string. Then `[1m]` via the existing strip. Do not write a second decoder. A decoded `Provider/some-model` is not a class name. Do not take the segment after the first slash.

```typescript
export function stripClaudeAppGatewayOneMillionContextSuffix(id: string): string {
  return id.trim().replace(/\[1m\]$/i, "").trim();
}
```

```typescript
export function decodeClaudeAppGatewayRouteId(routeId: string): string | undefined {
  const normalized = stripClaudeAppGatewayOneMillionContextSuffix(routeId).toLowerCase();
  const match = /^anthropic\/claude-ccr(?:\d+)?-h([0-9a-f]+)$/.exec(normalized);
  const encoded = match?.[1];
  if (!encoded || encoded.length % 2 !== 0) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(encoded, "hex").toString("utf8").trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
}
```

Match rules are RESEARCH.md Pattern 2. `best` is Opus. `claude-opusplan` does not match Opus (`p` is alphanumeric). Bare `opus` without `[1m]` is not a class request. Not a class, or the switch off: return the parent plan.

**1m filter:** keep a row only when `catalog`'s window is a finite number `>= 1_000_000`. The existing comparison is `gateway-routes.ts` lines 214-219, and it returns `undefined` when the metadata window is missing. An unknown window is dropped. Do not assume `200000` or `1000000`.

**Order:** scored rows first, score descending, then tier-word rows. Tie: `provider` then `model`, `localeCompare`. No bench, quota, tool, image, or thin-share filter in this phase.

**Error handling:** a corrupt snapshot is an empty shelf. Return the parent plan. Do not throw.

---

### `packages/core/src/class-switch/seam.ts` (utility, request-response)

**Analog:** `packages/core/src/runtime/desktop-app.ts` lines 7-9 for the env check. No module in this repo returns a parent value when an env var is `"0"`. The equality check is the pattern. The early return is new.

```typescript
export function isDesktopAppRuntime(): boolean {
  return process.env[CCR_DESKTOP_APP_ENV] === "1" && Boolean((process.versions as NodeJS.ProcessVersions & { electron?: string }).electron);
}
```

Use `process.env.CCR_CLASS_SWITCH === "0"` the same way: exact string, not a truthy check. When that is true, every exported function returns the parent value, `start` does not schedule, and the models fill does not add fields.

Export only the functions parent files call:

- `applyShelf(plan, input)` — called at the end of `createRouteExecutionPlan`. Returns the parent plan when the switch is off, the name is not a class, or the shelf has no resolvable model. Otherwise returns the same plan with `attempts` replaced.
- `start()` / `stop()` — called from the management server. Bodies live in `catalog.ts`.
- `applyContextWindows(response, config)` — called at the end of `createGatewayModelsResponse`.

Parent files do not import `catalog.ts` or `plan.ts`.

**`/v1/models` fill** (`model-discovery.ts` lines 104-115, 228-244, 303-343, 805-820): the parent function returns one of three builders. Assign that object, then return `applyContextWindows(...)`. Do not copy the fill into `pipeline.ts` or `router-plugin.ts`. Both servers already call this function.

```typescript
export function createGatewayModelsResponse(config: AppConfig, headers: IncomingHttpHeaders, apiKey?: ApiKeyConfig): Record<string, unknown> {
  const contextArchiveConfig = contextArchiveConfigForApiKey(config, apiKey);
  const contextArchiveCompact = Boolean(contextArchiveConfig && contextArchiveMcpEnabled(contextArchiveConfig));
  const profile = profileForApiKey(config, apiKey);
  if (isClaudeAppApiKey(apiKey)) {
    return createClaudeAppGatewayModelsResponse(config, { contextArchiveCompact, profile });
  }
  if (isClaudeCodeUserAgent(headers)) {
    return createClaudeAppGatewayModelsResponse(config, { claudeCode: true, contextArchiveCompact, profile });
  }
  return createOpenAICompatibleGatewayModelsResponse(config, profile);
}
```

Claude Code is the Anthropic-shaped branch: `isClaudeCodeUserAgent` is true when the user agent contains `claude` (lines 986-993). That branch already sets `max_input_tokens` and, when the parent window is a positive integer, `capabilities.context_window` (lines 805-820). The OpenAI branch has no window fields (lines 228-244).

When the switch is on and `catalog`'s window function returns a positive integer:

- Set top-level `context_window` and `max_context_window` on every object in `data`.
- If `capabilities.context_window` already exists, set `capabilities.context_window.max_input_tokens`.
- If `capabilities.context_management` already exists, set `capabilities.context_management.max_input_tokens`.
- Set `max_input_tokens` when that key is already on the object.

Do not remove parent fields. When the window is unknown, leave the object unchanged. Do not write `200000`. `isClaudeCodeUserAgent` is private. The fill does not need it: top-level numbers on every row, nested numbers only where the objects already exist.

---

### `packages/core/src/routing/execution-plan.ts` (service, transform)

**Analog:** this file. Keep the three branches (`off` / no body, `retry`, model-chain) at lines 16-45. Build that object as now. The last step is `return applyShelf(plan, input)` from `seam.ts`. One return. Do not call the shelf from inside the request loop. Do not import `catalog.ts` or `plan.ts` here.

Empty shelf and `CCR_CLASS_SWITCH=0` leave `attempts` as the parent built them. The existing unit assertion in `routing-architecture.test.mjs` lines 395-408 must stay true when the switch is off or the name is not a class. Do not edit that test file.

---

### `packages/core/src/web/management-server.ts` (service, event-driven)

**Analog:** this file. Import `start` and `stop` from `seam.ts` next to the existing auto-refresh import (line 37).

```typescript
import { stopProviderModelAutoRefreshService, syncProviderModelAutoRefreshService } from "@ccr/core/providers/model-auto-refresh";
```

Call `start()` at the end of the `try` in `startConfiguredServices`, after `syncProviderModelAutoRefresh(config)` (lines 513-516). Call `stop()` as the first line of `stopConfiguredServices`, next to `stopProviderModelAutoRefreshService()` (lines 519-520).

```typescript
syncProviderModelAutoRefresh(config);
  } catch (error) {
    console.error(`Failed to start configured services during ${reason}: ${formatError(error)}`);
  }
}

async function stopConfiguredServices(): Promise<void> {
  stopProviderModelAutoRefreshService();
```

Do not merge the two walks. Do not edit `syncProviderModelAutoRefresh` (lines 538-547). The parent `try/catch` already logs start failures with `` `Failed to start configured services during ${reason}: ${formatError(error)}` ``. A shelf-start throw is that same catch. Prefer `start()` not throwing: the timer callback already logs and reschedules.

---

### `packages/core/src/gateway/features/model-discovery.ts` (controller, request-response)

**Analog:** this file. The only edit is the end of `createGatewayModelsResponse` (lines 104-115): bind the three existing returns to one `response`, then `return applyContextWindows(response, config)`. Do not change `createClaudeAppGatewayModelsResponse`, `createOpenAICompatibleGatewayModelsResponse`, `claudeGatewayModelContextWindow`, or `effectiveProviderContextWindow`. `claudeGatewayModelContextWindow` (lines 400-408) returns `1_000_000` or `0` when it has no window. The shelf chain must not call it.

Do not edit `packages/core/test/unit/agents/claude-app-gateway-models.test.mjs`. Its `max_input_tokens` assertions (lines 291-294) stay valid because the fill adds fields and does not remove `capabilities`.

---

### `packages/core/test/unit/class-switch/classify.test.mjs` (test, transform + batch)

**Analog:** `packages/core/test/unit/usage/usage-normalization.test.mjs` lines 1-4 for a pure `node:test` file. Probe injection from `packages/core/test/unit/providers/provider-model-auto-refresh.test.mjs` lines 1-11 and 89-112.

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsageInputTokens } from "@ccr/core/usage/normalization.ts";
```

```javascript
import {
  hasAutoFetchModelProviders,
  refreshAutoFetchProviderModels,
  runProviderModelAutoRefreshNow
} from "@ccr/core/providers/model-auto-refresh.ts";
```

```javascript
const result = await refreshAutoFetchProviderModels(config, {
  probeProvider: async (request) => {
    calls.push(request);
    return {
      capabilities: [],
      models: ["alpha", "beta"],
      normalizedBaseUrl: request.baseUrl,
      protocols: []
    };
  }
});

assert.equal(calls[0].mode, "models");
assert.equal(calls[0].forceRefresh, true);
```

Test imports use the `.ts` suffix. Assert with `node:assert/strict` and flat `test()` calls. No Jest and no Vitest.

Pure tests call the exported classifier with the RESEARCH.md Pattern 4 fixtures (`cohere/command-a-plus`, `motif-technologies/motif-3`, `google/gemini-4-hydrogen`, `inclusionai/ling-3.2-flash:free`, `:batch`, one-step vs two-step tier disagreement, hex id with a score). They embed those objects. They do not fetch.

Walk tests call the run-once function with `probeProvider`. Assert `mode === "models"` and that no request body contains `"ping"`. A new id is classified. An id missing from a successful fetch leaves the shelf. A thrown probe keeps the previous id. `CCR_CLASS_SWITCH=0` does not schedule. Restore env in `finally`, as `model-catalog-file.test.mjs` lines 8-31 do for `CCR_MODEL_CATALOG_PATH`. Set `CCR_INTERNAL_USER_DATA_DIR` to a temp dir before a snapshot write (`model-catalog-file.test.mjs` lines 64-79).

---

### `packages/core/test/unit/class-switch/plan.test.mjs` (test, transform)

**Analog:** `packages/core/test/unit/gateway/routing-architecture.test.mjs` lines 1-8 and 395-408.

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
```

```javascript
test("execution planner includes primary and de-duplicated fallback attempts", () => {
  const plan = createRouteExecutionPlan({
    bodyModel: "Primary/alpha",
    fallback: {
      mode: "model-chain",
      models: ["Primary/alpha", "Secondary/beta", "Secondary/beta"],
      retryCount: 0
    },
    hasRequestBody: true
  });

  assert.deepEqual(plan.attempts, [
    { index: 0, model: "Primary/alpha" },
    { index: 1, model: "Secondary/beta" }
  ]);
```

New file. Do not add cases to `routing-architecture.test.mjs`. Cover SHELF-01: `best` opens Opus; `claude-fable-…` / `claude-opus-…` / `claude-sonnet-…` / `claude-haiku-…` open that class; `claude-opusplan` does not; `opus[1m]` drops a window under `1_000_000` and an unknown window; hex route id of `claude-opus-4-6` opens Opus; switch `"0"` keeps the parent plan; an empty shelf keeps the parent `attempts`.

`ModelRegistry` construction in that same test file (lines 17-46) is the fixture shape when a test needs `resolve` to return a provider target.

---

### `packages/core/test/unit/class-switch/context-window.test.mjs` (test, request-response)

**Analog:** `packages/core/test/unit/agents/claude-app-gateway-models.test.mjs` lines 1-48 and 270-294.

```javascript
function createClaudeCodeModelsResponse(config) {
  return createGatewayModelsResponse(config, { "user-agent": "claude-cli/2.1.215" });
}
```

```javascript
modelMetadata: {
  aaa: {
    contextWindow: 1_000_000,
    maxContextWindow: 1_000_000
  }
},
// ...
assert.equal(discoveredModel.max_input_tokens, 1_000_000);
assert.equal(discoveredModel.capabilities.context_window.max_input_tokens, 1_000_000);
```

Call `createGatewayModelsResponse` the same way. Do not edit the parent test. Assert a metadata window of `272000` becomes top-level `context_window` and `max_context_window` of `272000`, not `200000`. An unknown window does not add those fields and does not add `200000`. `CCR_CLASS_SWITCH=0` does not add them. Use a Claude user agent for the Anthropic branch and a non-Claude user agent for the OpenAI branch (OpenAI objects gain only the two top-level numbers).

---

## Shared Patterns

### Imports
**Source:** `packages/core/src/routing/execution-plan.ts` lines 1-6; tests in `packages/core/test/unit/usage/usage-normalization.test.mjs` lines 1-3
**Apply to:** all three new source files and all three new tests

Source: `import { ... } from "@ccr/core/<domain>/<file>"` with no extension. Tests: the same path plus `.ts`. `export type` for domain types. Kebab-case filenames. No `interface`.

### Kill switch
**Source:** `packages/core/src/runtime/desktop-app.ts` lines 7-9
**Apply to:** `seam.ts`, and therefore every parent call

`process.env.CCR_CLASS_SWITCH === "0"` returns the parent plan, does not schedule, does not fetch, and does not add context-window fields. Any other value, including unset, runs the phase.

### Error handling
**Source:** `packages/core/src/providers/model-auto-refresh.ts` lines 171-179 and 718-720; `packages/core/src/models/catalog-file.ts` lines 63-65
**Apply to:** `catalog.ts` provider loop, score GET, and snapshot read

```typescript
} catch (error) {
  const message = formatError(error);
  options.logger?.warn?.(`[providers] Failed to refresh models for ${providerName}: ${message}`);
```

```typescript
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

A failed provider list keeps that provider's previous ids. A failed score GET keeps the previous score table. A bad snapshot on the request path is "no shelf", and the parent plan is returned. Do not throw on the request path. Do not log `Authorization`.

### Validation
**Source:** `packages/core/src/gateway/features/model-discovery.ts` lines 491-495; `packages/core/src/contracts/app.ts` lines 246-254
**Apply to:** scores, windows, and snapshot read

```typescript
function positiveInteger(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined;
}
```

A score index counts only when `Number.isFinite`. Ignore unknown JSON keys. Do not eval model ids. On snapshot read, accept only the `ShelfSnapshot` shape.

### Probe and auth
**Source:** `packages/core/src/providers/probe.ts` lines 577-586, 685-699, 1570-1577
**Apply to:** `catalog.ts` only

`mode: "models"` and `forceRefresh: true`. Bearer header only on the 401 retry, and only from an enabled provider whose base URL host is `openrouter.ai`. The snapshot does not store the key.

### Tests
**Source:** `packages/core/test/unit/providers/provider-model-auto-refresh.test.mjs`, `packages/core/test/unit/models/model-catalog-file.test.mjs` lines 8-31
**Apply to:** all three new test files

`node:test` + `node:assert/strict`. Flat `test()`. Restore `process.env` in `finally`. Do not edit parent test files. Do not put `*.test.*` under `packages/core/src/class-switch/` (`tsconfig` `rootDir` is `src`, and `build/test.mjs` compiles `packages/core/test` only). `workflow.tdd_mode` is true: the failing tests land before the implementation. Quick command: `npm run test:unit -w @claude-code-router/core`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Classifier functions inside `catalog.ts` | service | transform | No score, tier-token, `:batch`, or review-queue function exists. Use RESEARCH.md Pattern 4, including the inline fixtures. Do not add a fourth source file for it. |
| `seam.ts` early-return wrapper | utility | request-response | `desktop-app.ts` only shows `process.env.NAME === "1"`. Nothing returns a caller's value when an env var is `"0"`. |

## Metadata

**Analog search scope:** `packages/core/src/{providers,models,routing,gateway,web,agents/claude-app,runtime,contracts}`, `packages/core/test/unit/{providers,models,gateway,agents,usage}`
**Files scanned:** 209 `packages/core/src` TypeScript files and 118 `packages/core/test/unit` tests (glob). 16 analog files read.
**Pattern extraction date:** 2026-11-14

**Tracked analogs:** `model-auto-refresh.ts`, `catalog-file.ts`, `execution-plan.ts`, `contracts.ts`, `model-registry.ts`, `gateway-routes.ts`, `model-discovery.ts`, `model-catalog.ts`, `probe.ts`, `contracts/app.ts`, `app-paths.ts`, `desktop-app.ts`, `management-server.ts`, `gateway/internal/shared.ts`, `provider-model-auto-refresh.test.mjs`, `model-catalog-file.test.mjs`, `routing-architecture.test.mjs`, `claude-app-gateway-models.test.mjs`, `usage-normalization.test.mjs`.

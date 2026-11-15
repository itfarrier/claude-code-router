# Phase 2: Live choice - Pattern Map

**Mapped:** 2026-11-14
**Files analyzed:** 8 (1 new source, 2 new tests, 5 parent or Phase 1 edits)
**Analogs found:** 8 / 8

New source file: `packages/core/src/class-switch/bench.ts` only. `catalog.ts` stays as Phase 1 wrote it. Parent edits: `plan.ts`, `seam.ts`, `execution-plan.ts`, `executor.ts`, `pipeline.ts`. Tests only in `packages/core/test/unit/class-switch/`. Parent files import `seam.ts` only. `seam.ts` calls `plan.ts` and `bench.ts`. `plan.ts` may call `bench.ts`. `bench.ts` may call `catalog.ts`. Do not create `notice.ts`. Do not edit `credential-pool.ts`. Do not add a field to `UpstreamAttempt`, `RouteAttemptPlan`, or `RouteExecutionPlan`.

`packages/core/src/web/management-server.ts` already calls `start` / `stop` from `seam.ts` (lines 516 and 523). Do not edit it. The bench timer starts inside `seam.start()`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/class-switch/bench.ts` | service | file-I/O + event-driven | `packages/core/src/class-switch/catalog.ts` | role-match |
| `packages/core/src/class-switch/plan.ts` | service | transform | this file | exact (in-place) |
| `packages/core/src/class-switch/seam.ts` | utility | request-response | this file | exact (in-place) |
| `packages/core/src/routing/execution-plan.ts` | service | transform | this file | exact (in-place) |
| `packages/core/src/gateway/upstream/executor.ts` | service | request-response | this file | exact (in-place) |
| `packages/core/src/gateway/request/pipeline.ts` | controller | request-response | this file | exact (in-place) |
| `packages/core/test/unit/class-switch/bench.test.mjs` | test | file-I/O + event-driven | `packages/core/test/unit/class-switch/classify.test.mjs` | role-match |
| `packages/core/test/unit/class-switch/choice.test.mjs` | test | transform + request-response | `packages/core/test/unit/class-switch/plan.test.mjs` | role-match |

`git ls-files` prints every analog path below. None is a gitignored mirror.

## Pattern Assignments

### `packages/core/src/class-switch/bench.ts` (service, file-I/O + event-driven)

**Analog:** `packages/core/src/class-switch/catalog.ts` for the snapshot file, the injectable timer, and the probe argument object. `packages/core/src/providers/probe.ts` for `mode: "connectivity"`. `packages/core/src/providers/credential-pool.ts` for the in-memory until-map shape only. Do not edit `credential-pool.ts`. Do not import its unexported `providerCredentialCooldownMs`.

**Imports pattern** (`catalog.ts` lines 1-24): `@ccr/core/...` with no `.ts` suffix. `export type`, not `interface`.

```typescript
import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import { probeGatewayProvider } from "@ccr/core/providers/probe";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";
```

**Path and atomic write** (`catalog.ts` lines 331-333 and 922-931): same directory, filename `class-switch-bench.json`. The file stores credential ids and model ids. It does not store an API key.

```typescript
export function shelfSnapshotPath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "class-switch-shelves.json");
}
```

```typescript
export async function writeShelfSnapshot(snapshot: ShelfSnapshot): Promise<void> {
  const file = shelfSnapshotPath();
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporaryFile, JSON.stringify(snapshot), "utf8");
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}
```

**Read** (`catalog.ts` lines 383-391): `JSON.parse` inside `try/catch`. A missing or invalid file is an empty bench, not a throw.

```typescript
export function readShelfSnapshot(): ShelfSnapshot | undefined {
  try {
    const raw = readFileSync(shelfSnapshotPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isShelfSnapshot(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
```

The next attempt in the same request must see a park before the disk rename finishes. Keep the table in a module-level `Map`, update that map before `record` returns, then persist with the rename above. Load the file into the map on first read. `credential-pool.ts` lines 16-17 are the map shape to copy, not a module to edit:

```typescript
const providerCredentialCooldownMs = 60_000;
const providerCredentialCooldowns = new Map<string, { reason: string; until: number }>();
```

Use the literal `60_000` for a 429 with no clock. That constant is not exported. `shortcut: same duration as providerCredentialCooldownMs, import it only if credential-pool.ts becomes editable.`

**Timer** (`catalog.ts` lines 431-437, 833-843, 896-920): one module-level `setTimeout`, `unref()`, cleared on stop. Tests pass `schedule` and `probeProvider`. `seam.start()` calls the bench start only when `process.env.CCR_CLASS_SWITCH !== "0"`. `CCR_CLASS_SWITCH=0` starts neither the catalog walk nor this timer. Do not merge this timer into `scheduleCatalogWalk`. The catalog interval stays `providerModelAutoRefreshIntervalMs`. This timer's period is 30 seconds.

```typescript
export type ClassSwitchCatalogOptions = {
  fetchScores?: () => Promise<{ ok: boolean; rows: OpenRouterModelRow[] }>;
  loadConfig?: () => Promise<AppConfig>;
  logger?: Pick<Console, "warn">;
  probeProvider?: ClassSwitchCatalogProbe;
  schedule?: (delayMs: number, run: () => void | Promise<void>) => void;
};
```

```typescript
function defaultCatalogSchedule(delayMs: number, run: () => void | Promise<void>): void {
  if (catalogWalkTimer) {
    clearTimeout(catalogWalkTimer);
  }
  catalogWalkTimer = setTimeout(() => {
    catalogWalkTimer = undefined;
    void Promise.resolve(run());
  }, delayMs);
  catalogWalkTimer.unref?.();
}
```

Add `now?: () => number` on the bench options. Tests pass `now`. Default `Date.now`.

**Probe call** (`catalog.ts` lines 808-816): copy the argument object. Change `mode` to `"connectivity"` and `models` to a one-element array. `forceRefresh: true`. `probe.ts` line 96 is `const probeOutputTokenLimit = 1`. `pickProbeModel` (`probe.ts` lines 1673-1692) returns `candidates[0]` when the regex misses, so a one-element list probes that model. Do not pass `mode: "models"`. Do not probe a model that is not on a shelf (`shelves` only, not `excluded`, not `review`).

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

`providerApiKeyForModelRefresh`, `providerModelRefreshProtocols`, and `providerPluginsForModelRefresh` are private in `catalog.ts` (lines 466-475 and 491-539). Do not export them and do not edit `catalog.ts`. Copy the key-field reads. A 401 recheck probes that credential's key (`credential.api_key || credential.apiKey || credential.apikey`, `catalog.ts` lines 462-464), not the first key on the provider. A model-scoped probe uses one live credential of that provider. Do not log the key.

`GatewayProviderProbeRequest.mode` is `"connectivity" | "models" | "protocols"` (`contracts/app.ts` lines 577-586).

**Park scopes** are RESEARCH.md Pattern 3. No function in this repo stores those scopes. `recordProviderCredentialOutcome` (`credential-pool.ts` lines 57-64) is the behavior class requests must not call: it writes a 60-second cooldown for 401, 403, 429, and 5xx, and it clears on 404.

```typescript
if (statusCode >= 200 && statusCode < 500 && statusCode !== 401 && statusCode !== 403 && statusCode !== 429) {
  incrementProviderCredentialCounters(provider, credential, estimateLimitUsage(method, attempt.body ?? Buffer.alloc(0)));
  clearProviderCredentialCooldown(provider, credential);
  return;
}
if (statusCode === 401 || statusCode === 403 || statusCode === 429 || statusCode >= 500) {
  setProviderCredentialCooldown(provider, credential, providerCredentialCooldownMs, `HTTP ${statusCode}`);
}
```

Credential id is the slug `selectProviderCredentials` already stores (`executor.ts` lines 1032-1034): `providerCredentialSlug(providerCredentialRuntimeId(provider, credential, providerIndex))`. `providerCredentialSlug` is `runtime-topology.ts` lines 338-344. The bench key uses that slug. Never store `api_key`.

**Time parser:** no function to copy. `retry-policy.ts` lines 41-47 parse `retry-after` and then `retryDelayAfterStatus` (lines 13-18) clamps the result to 60 seconds. Do not call either for the stored until-time. Header order, Groq durations, and the digit-length rule are RESEARCH.md Pattern 4. Do not read `error.message`. A 429 with no hit parks `60_000` ms. Log that line with `no-provider-time`.

**Log line:** prefix matches the catalog warn (`catalog.ts` line 888), level is `console.info` so a leg is not a catalog failure. Tests replace `console.info`.

```typescript
options.logger?.warn?.(`[class-switch] Catalog refresh failed: ${formatCatalogError(error)}`);
```

```text
[class-switch] leg status=429 provider=openrouter model=nvidia/nemotron-3 credential=cred:third until=2026-11-14T22:05:00.000Z
[class-switch] fix-key provider=openrouter credential=cred:third status=403
```

The credential value is the slug. A 403 with no time sets `probe: false` and logs `fix-key`. The timer skips `probe: false`.

**Error handling:** a bad bench file is an empty table. The request path does not throw. A probe throw is the catalog catch (`catalog.ts` lines 822-825): log `formatCatalogError` (lines 445-447) and leave the previous parks.

---

### `packages/core/src/class-switch/plan.ts` (service, transform)

**Analog:** this file. Keep `parseClassRequest` (lines 49-84) and the `[1m]` filter (lines 105-110). `attemptsForClass` (lines 112-137) gains one optional scalar argument. It still returns `undefined` when the list is empty (line 136). It does not take `body`, `messages`, or `headers`.

```typescript
export function attemptsForClass(
  parsed: ParsedClassRequest,
  modelRegistry: ModelRegistry | undefined
): RouteAttemptPlan[] | undefined {
  const snapshot = readShelfSnapshot();
  if (!snapshot) {
    return undefined;
  }
  const rows = [...snapshot.shelves[parsed.shelfClass]]
    .filter((row) => rowPassesOneMillionFilter(row, parsed.requireOneMillion))
    .sort(compareShelfRows);
  // ...
  return attempts.length ? attempts : undefined;
}
```

**Sort** (`plan.ts` lines 86-103) stays the first key and the last key. Insert the new keys between the score compare and `localeCompare`: confirmed before unchecked only when scores are equal; higher remaining requests, then higher remaining tokens; lower last success duration. Unknown does not beat a known lower remainder or a known slower model. A missing score stays last, as this function already does. Read confirmed, remainder, and duration from `bench.ts`. Do not store them on `ShelfRow`.

```typescript
function compareShelfRows(left: ShelfRow, right: ShelfRow): number {
  const leftScored = typeof left.score === "number" && Number.isFinite(left.score);
  const rightScored = typeof right.score === "number" && Number.isFinite(right.score);
  if (leftScored !== rightScored) {
    return leftScored ? -1 : 1;
  }
  if (leftScored && rightScored) {
    const byScore = right.score! - left.score!;
    if (byScore !== 0) {
      return byScore;
    }
  }
  const byProvider = left.provider.localeCompare(right.provider);
  if (byProvider !== 0) {
    return byProvider;
  }
  return left.model.localeCompare(right.model);
}
```

**Filters, after the `[1m]` check, before the sort.** Drop a row when `bench` says the model is parked (404 or 5xx for that provider + model, or quota zero). Tool and image use the raw catalog value, not `readCatalogCapability`. That helper is true only for `=== true` (`model-catalog.ts` lines 180-182), so a missing key is false and must not drop the row.

```typescript
export function readCatalogCapability(capabilities: ModelCatalogCapabilities, key: string): boolean {
  return capabilities[key] === true;
}
```

Look up the entry with `findProviderModelCatalogEntry` (`model-catalog.ts` lines 80-104). Drop tools only when the request has a tool name and the entry has `toolCalling === false` or `functionCalling === false`. `ProviderModelCapabilities` has no `tools` field (`contracts/app.ts` lines 198-201). Drop an image only when `hasImage` is true and either `metadata.capabilities.imageInput === false` or the catalog value `imageInput` or `vision` is `false`. Missing means keep. The metadata read that preserves `undefined` is `model-discovery.ts` lines 847-851. Do not edit that file.

```typescript
function providerModelCapabilityOverrides(
  metadata: ProviderModelMetadata | undefined
): { imageInput?: boolean; reasoning?: boolean; reasoningLevels?: string[] } {
  const imageInput = metadata?.capabilities?.imageInput;
  const imageOverride = imageInput === undefined ? {} : { imageInput };
```

Context: `estimatedTokens` greater than a finite `contextWindow > 0` drops the row. A missing window keeps it. The `[1m]` rule is unchanged.

**Thin share:** after the sort, a process-local counter. A neighbor is a later row with the same confirmed rank and a score within 2 of index 0. When `counter % 20 === 0` and a neighbor exists, move the first neighbor to index 0 for this call. Otherwise the leader stays. No `Math.random`. Export a setter the tests call. `shortcut: the counter dies on process restart, which is the whole share.`

**One row per live token:** `activeProviderCredentials` (`runtime-topology.ts` lines 96-104) then drop credentials `bench` has parked for that model. One `RouteAttemptPlan` per remaining credential, same `model` selector `` `${provider}/${model}` `` and same `target`. Zero live credentials drops the model. Do not put `credentialId` on `RouteAttemptPlan`. `buildUpstreamAttempts` copies only `index`, `model`, and `target` (`executor.ts` lines 1100-1104). The next row is the next token because the first token is parked before the loop continues, and `selectProviderCredentials` then returns the next live slug.

**Tool turn:** a process-local `Map` from `sessionId` to `{ provider, credentialId, model }`. On the next call, `toolTurn` true and that triple still live returns one row. If it is benched, delete the entry and build the normal list. No `sessionId` means no memory. `remember` is a function `seam` calls on a class 2xx. `shortcut: process memory only, a restart ends the tool-turn stickiness.`

**`requestFacts` and `liftToolResultImages`:** new exports in this file, re-exported by `seam.ts`. They are not the policy. `attemptsForClass` does not call them.

`requestFacts` calls `estimateLimitUsage` (`window-limiter.ts` lines 52-81). `hasImage` is `imageCount > 0`. `countImageInputs` (lines 116-123) already recurses, including into `tool_result`. Do not write a second image walker. Tool names are `route-script-context.ts` lines 116-124. `toolTurn` is true when the last user content is a non-empty array and every block has `type` `tool_result`. Also return `metadata.session_id` when it is a non-empty string. Do not return the metadata object.

```typescript
export function estimateLimitUsage(method: string, requestBody: Buffer): ApiKeyLimitUsage {
  if (method.toUpperCase() !== "POST" || requestBody.byteLength === 0) {
    return { imageCount: 0, totalTokens: 0 };
  }
  // ...
  return {
    imageCount: countImageInputs(body),
    totalTokens: Math.max(1, inputTokens + outputTokens)
  };
}
```

```typescript
function toolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tool) => {
    if (!isRecord(tool)) return [];
    const fn = isRecord(tool.function) ? tool.function : undefined;
    const name = typeof tool.name === "string" ? tool.name : typeof fn?.name === "string" ? fn.name : undefined;
    return name ? [name] : [];
  });
}
```

`liftToolResultImages` copies the body. `parseJsonObjectCached` (`body.ts` lines 9-12) forbids mutation of the cached object. Copy user-message arrays before moving blocks. For each `tool_result` whose `content` is an array, move blocks with `type` `image`, `image_url`, or `input_image` onto the parent content array. If the tool result then has no text block, append `{ type: "text", text: "image" }`. Return the new object. The executor serializes it with `serializeJsonBody` (`body.ts` lines 61-65). No function in this repo lifts those blocks. Do not edit `@the-next-ai/ai-gateway`.

**Error handling:** a corrupt shelf is `undefined`, and the caller keeps the parent plan. Do not throw.

---

### `packages/core/src/class-switch/seam.ts` (utility, request-response)

**Analog:** this file. The env check (lines 170-175 and 181-184) stays exact string `"0"`.

```typescript
export function start(config: AppConfig): void {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  startClassSwitchCatalog(config, { loadConfig: loadAppConfig });
}
```

```typescript
export function applyShelf(plan: RouteExecutionPlan, input: RouteExecutionPlanInput): RouteExecutionPlan {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return plan;
  }
  const parsed = parseClassRequest(input.bodyModel ?? input.primaryModel);
  if (!parsed) {
    return plan;
  }
  const attempts = attemptsForClass(parsed, input.modelRegistry);
  if (!attempts) {
    return plan;
  }
  return { ...plan, attempts };
}
```

`start` also starts the bench timer. `stop` (lines 177-179) stops both. `CCR_CLASS_SWITCH=0` starts neither.

Add optional scalars to `RouteExecutionPlanInput` (lines 27-33). Absent means empty `toolNames`, `hasImage: false`, `estimatedTokens: 0`, `toolTurn: false`, no `sessionId`. That keeps `plan.test.mjs` green.

```typescript
export type RouteExecutionPlanInput = {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
};
```

`applyShelf` passes the scalars into `attemptsForClass`. One predicate, `classShelfActive(input)`, is that same function's boolean. `executor.ts` calls it with the same input object `createRouteExecutionPlan` received. Do not put the boolean on the plan.

**Class-attempt mark, because `UpstreamAttempt` is closed** (`shared.ts` lines 182-192). A `WeakSet<UpstreamAttempt>` in this file. `markClassAttempt` / `isClassAttempt`. The executor marks the object `prepareUpstreamCredentialAttempt` returns. `pipeline.ts` and the executor failure path call `isClassAttempt` on that same object. Do not add a property. Do not add a header: `omitLocalObservabilityHeaders` only strips `localObservabilityHeaderNames` (`shared.ts` lines 274-284), and a new header would be forwarded. Do not edit `shared.ts`.

Re-export only what parent files call: the Phase 1 exports, plus `classShelfActive`, `requestFacts`, `liftToolResultImages`, `markClassAttempt`, `isClassAttempt`, `recordClassRefusal`, `recordClassSuccess`, `rememberedCredential`. Those bench and plan functions stay implemented in `bench.ts` and `plan.ts`. Parent files do not import those modules.

Session id for the executor: the six headers in `context-archive.ts` lines 720-726, case-insensitive find at lines 790-796. Then `metadata.session_id` from `requestFacts`. Do not copy lines 728-730 (`sessionId`, `conversation_id`, `body.conversation_id`). Do not copy the `request-${requestId}` fallback at line 733. No id means no stickiness. Do not edit `context-archive.ts`. `readHeader` there is private.

```typescript
const candidates = [
  readHeader(headers, "x-claude-code-session-id"),
  readHeader(headers, "x-claude-session-id"),
  readHeader(headers, "x-codex-session-id"),
  readHeader(headers, "x-openai-session-id"),
  readHeader(headers, "x-agent-session-id"),
  readHeader(headers, "x-session-id"),
  stringValue(isRecord(body.metadata) ? body.metadata.session_id : undefined),
```

---

### `packages/core/src/routing/execution-plan.ts` (service, transform)

**Analog:** this file. The three branches (lines 18-45) stay. The last line stays `return applyShelf(plan, input)` (line 46). Add the optional scalars to the inline parameter (lines 9-15) and pass that same object through. Do not import `plan.ts` or `bench.ts`. Do not add a fallback mode. Do not call the shelf from inside the request loop.

```typescript
export function createRouteExecutionPlan(input: {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
}): RouteExecutionPlan {
  // ... off / retry / model-chain ...
  return applyShelf(plan, input);
}
```

Empty live list and `CCR_CLASS_SWITCH=0` leave `attempts` as the parent built them. Do not edit `routing-architecture.test.mjs`.

---

### `packages/core/src/gateway/upstream/executor.ts` (service, request-response)

**Analog:** this file. The list is built once in `buildUpstreamAttempts` (lines 1083-1105). Do not call `attemptsForClass` again from the `for` loop.

```typescript
function buildUpstreamAttempts(
  config: AppConfig,
  fallback: RouterFallbackConfig,
  method: string,
  path: string,
  body: Buffer | undefined,
  routedModel: string | undefined
): UpstreamAttempt[] {
  const parsedBody = parseJsonObjectSafe(body);
  const modelInPath = requestProtocolForPath(path) === "gemini_generate_content";
  const plan = createRouteExecutionPlan({
    bodyModel: modelInPath ? undefined : stringValue(parsedBody?.model),
    fallback,
    hasRequestBody: shouldSendBody(method) && (fallback.mode !== "model-chain" || Boolean(parsedBody)),
    modelRegistry: modelRegistryForConfig(config),
    primaryModel: routedModel
  });
  return plan.attempts.map((attempt) => ({
    index: attempt.index,
    model: attempt.model,
    target: attempt.target
  }));
}
```

In this function, call `requestFacts(method, body)` from `seam.ts`. Pass `toolNames`, `hasImage`, `estimatedTokens`, `toolTurn`, and the session id into `createRouteExecutionPlan`. The body does not go in. Session id is the seam helper over `input.headers` plus `requestFacts`'s `metadata.session_id`. `fetchUpstreamWithFallback` must pass the headers into `buildUpstreamAttempts`. Compute `classLive` with `classShelfActive` on that same input. `classLive` is a local. It is not a field on the mapped attempt.

When `classLive`, call `liftToolResultImages` on a copy of the parsed body and serialize with `serializeJsonBody` before the attempts use the body. A non-class request, including `CCR_CLASS_SWITCH=0` and an empty shelf, does not lift.

**One credential** (`executor.ts` lines 674-693): non-class requests keep the `join(",")` of every selected credential. A class attempt, after parked keys are removed, sets both headers and both arrays to `selection.credentials[0]` only.

```typescript
const headers: Record<string, string> = {
  ...attemptHeaders,
  "x-target-providers": selection.credentials.map((candidate) => candidate.internalName).join(","),
  "x-ccr-logical-provider": providerRuntimeId(target.provider),
  "x-ccr-provider-credential-chain": selection.credentials.map((candidate) => candidate.credentialId).join(",")
};
```

Filter bench-parked credentials out of the `credentials` array before `selectProviderCredentials` (lines 1019-1049). Leave that function's sort (lines 1059-1064) as it is. Do not add a round-robin cursor. Pass `classLive` on the `prepareUpstreamCredentialAttempt` input object, not on `UpstreamAttempt`. `prepareGatewayUpstreamAttemptForTest` (lines 68-118) omits it, so existing tests stay on the full chain.

When `classLive` and `rememberedCredential(sessionId)` is set, filter `credentials` to that slug before the select, so the parent sort cannot switch tokens during a tool turn.

```typescript
const prioritySorted = [...candidates].sort((left, right) =>
  left.priority - right.priority ||
  left.limitState.utilization - right.limitState.utilization ||
  right.weight - left.weight ||
  left.index - right.index
);
```

**Continuation** (`executor.ts` lines 499-533): the class branch runs before `shouldFallbackAfterStatus`. Stop on 400: no bench row, no next row. Continue with `delayMs = 0` on 401, 402, 403, 404, 408, 409, 429, and `status >= 500`. Write a bench row only for 429, 401, 403, 404, and 5xx. 402, 408, and 409 try the next row and write nothing. Do not call `retryDelayAfterStatus` or `retryDelayAfterNetworkError` for a class continuation. Those are `retry-policy.ts` lines 5-18 (base 1 second, cap 30 seconds, `Retry-After` clamped to 60 seconds).

```typescript
if (hasNextAttempt && shouldFallbackAfterStatus(response.status, fallbackMode)) {
  const delayMs = retryDelayAfterStatus(response.headers, failedAttempts.length);
  // ...
  recordProviderCredentialOutcome(input.config, input.method, attempt, response.status, response.headers);
  void cancelResponseBody(response);
  if (delayMs > 0) {
    await delay(delayMs, input.signal);
  }
  continue;
}
```

`shouldFallbackAfterStatus` follows `Router.fallback.mode` (`failure-classifier.ts` lines 10-17). A class request ignores that mode. Non-class requests still call it.

```typescript
shouldFallback: mode === "model-chain"
  ? statusCode >= 400
  : failureClass === "retryable" || failureClass === "rate-limit" || failureClass === "server"
```

On a class refusal, mark the attempt, skip `recordProviderCredentialOutcome` when `isClassAttempt(attempt)`, pass headers to `recordClassRefusal`. Read a JSON body only when `shouldBufferAggregateErrorBody` is true (`error-detail.ts` lines 45 and 319-326, same guard as `pipeline.ts` lines 913-930), then `response.text()`. If the guard is false, headers only. The 60-second shortcut covers a body that was not read. Then `cancelResponseBody`. Do not read a 2xx body. A 2xx returns that response. If `classLive` and a session id exists, `recordClassSuccess` then `remember`. `recordClassSuccess` clears parks for that triple, sets confirmed, and stores the duration (`Date.now() - attemptStartedAt`) and remainder headers. A 2xx with remaining count `0` parks that token for the next request. It does not continue the loop.

Network errors (`executor.ts` lines 559-599): a class error with a next row uses delay 0 and writes no bench row. Non-class errors still use `retryDelayAfterNetworkError`.

Do not import `recordUsage` or `recordGatewayUsageCapture`. The card stays in `pipeline.ts`.

---

### `packages/core/src/gateway/request/pipeline.ts` (controller, request-response)

**Analog:** this file. One edit, at line 906. Skip the call when `isClassAttempt(upstreamResult.attempt)`. Import that function from `seam.ts`. Do not add `x-ccr-requested-model` or `x-ccr-served-model`. Do not edit the body of `recordProviderCredentialOutcome`.

```typescript
recordProviderCredentialOutcome(this.config, method, upstreamResult.attempt, upstreamResponse.status, responseHeaders);
```

`recordUsage` (lines 256-258) stays one call per user request. Do not add a call on a failed leg. `buildTotals` (`usage/store.ts` lines 1035-1043) counts every usage event. A second event makes a failed leg look like a failed user request.

```typescript
const recordUsage = (input: Omit<UsageCaptureInput, "config">) => {
  void recordGatewayUsageCapture({ ...input, config: usageAttributionConfig });
};
```

`replayContextArchive` (lines 1186-1197) also calls `fetchUpstreamWithFallback`. It does not call `recordProviderCredentialOutcome`. The executor skip covers it. Do not add a second policy call there.

---

### `packages/core/test/unit/class-switch/bench.test.mjs` (test, file-I/O + event-driven)

**Analog:** `packages/core/test/unit/class-switch/classify.test.mjs` lines 462-491 for injected `probeProvider` and `schedule`. Temp dir from `plan.test.mjs` lines 35-40. Env restore from `model-catalog-file.test.mjs` lines 8-31.

```javascript
probeProvider: async () => {
  probePasses += 1;
  // ...
  return { capabilities: [], models, protocols: [] };
},
schedule(delayMs, run) {
  if (delayMs !== 0) {
    return;
  }
  queueMicrotask(() => void run());
}
```

```javascript
async function withShelfDataDir(run) {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-class-switch-test-"));
  try {
    process.env.CCR_INTERNAL_USER_DATA_DIR = dir;
    await run(dir);
```

New file. Flat `test()` and `node:assert/strict`. Import the bench source with the `.ts` suffix. Pass `now` and `probeProvider`. Assert `mode === "connectivity"`, `models.length === 1`, and that `mode: "models"` is absent. Cover BENCH-01, BENCH-02, and BACK-02 from RESEARCH.md. A fixture `2m59.56s` is a duration from `now`, not `now + 60_000`. A 13-digit reset is milliseconds. A message string that contains a time writes no until from that string. No test imports a free-tier RPM table. Restore `CCR_CLASS_SWITCH` and `CCR_INTERNAL_USER_DATA_DIR` in `finally`.

`workflow.tdd_mode` is true. This file is committed failing before `bench.ts` implements the cases.

---

### `packages/core/test/unit/class-switch/choice.test.mjs` (test, transform + request-response)

**Analog:** `plan.test.mjs` lines 1-33 for the shelf plan and the registry fixture. Fetch stub from `packages/core/test/unit/gateway/upstream-executor.test.mjs` lines 21-64. Do not edit that file. Do not edit `plan.test.mjs`. Its hex and slash cases stay.

```javascript
function classPlan(bodyModel, registry, overrides = {}) {
  return createRouteExecutionPlan({
    bodyModel,
    fallback: { mode: "off", models: [], retryCount: 0 },
    hasRequestBody: true,
    modelRegistry: registry,
    primaryModel: bodyModel,
    ...overrides
  });
}
```

```javascript
globalThis.fetch = async (...args) => {
  fetchCount += 1;
  return fetchImpl(...args);
};
```

Call `createRouteExecutionPlan` with the scalar bag for CHOICE-01, CHOICE-02, the image flag, and the tool-turn case. Call `liftToolResultImages` on a fixture whose image sits inside `tool_result`. Call `fetchUpstreamWithFallback` for one `x-target-providers` value, delay 0 on 429, and no next row on 400. After a class 5xx, `readProviderCredentialCooldown` is undefined. Spy `console.info`: the line has the credential slug and does not contain the fixture API key; a 403 with no time contains `fix-key`. Do not drive `pipeline.ts`, so this file does not call `recordUsage`. Assert the executor path under test does not call it.

Set the thin-share counter. Request 1 keeps the leader. The request where `counter % 20 === 0` puts the neighbor first. `attemptsForClass` is reached without a body argument. `CCR_CLASS_SWITCH=0` keeps the parent attempt.

---

## Shared Patterns

### Imports and the only parent door
**Source:** `packages/core/src/routing/execution-plan.ts` line 6; `packages/core/src/class-switch/seam.ts` lines 1-8
**Apply to:** `execution-plan.ts`, `executor.ts`, `pipeline.ts`, both new tests

Parent files import `@ccr/core/class-switch/seam` only. Tests import the source path plus `.ts`. `export type` for domain types. Kebab-case filenames. No `interface`. No new npm dependency.

### Kill switch
**Source:** `packages/core/src/class-switch/seam.ts` lines 170-184
**Apply to:** `seam.start`, `seam.stop`, `applyShelf`, `classShelfActive`, the bench timer

`process.env.CCR_CLASS_SWITCH === "0"` returns the parent plan, does not start the bench timer, does not lift images, and does not send one credential. Any other value, including unset, runs the phase.

### Closed attempt type
**Source:** `packages/core/src/gateway/internal/shared.ts` lines 182-192; `packages/core/src/routing/contracts.ts` lines 66-76
**Apply to:** `plan.ts`, `executor.ts`, `pipeline.ts`, `seam.ts`

```typescript
export type UpstreamAttempt = {
  body?: Buffer;
  credentialChain?: string[];
  credentialIds?: string[];
  credentialProtocol?: GatewayProviderProtocol;
  headers?: Record<string, string>;
  index: number;
  logicalProvider?: string;
  model?: string;
  target?: RouteModelRef;
};
```

`RouteAttemptPlan` is `index`, `model?`, `target?`. The class bit is `classShelfActive` plus the `WeakSet` in `seam.ts`. The credential for a row is "first slug after the bench filter", not a new field. A sticky tool turn filters to the remembered slug before that select.

### One credential and no parent cooldown
**Source:** `packages/core/src/gateway/upstream/executor.ts` lines 674-678 and 526; `packages/core/src/gateway/request/pipeline.ts` line 906
**Apply to:** class attempts only

Non-class: full `x-target-providers` chain and both `recordProviderCredentialOutcome` calls. Class: one internal name, one credential id, and neither call. `CCR_CLASS_SWITCH=0` is the non-class path.

### Class delay is 0
**Source:** `packages/core/src/gateway/upstream/retry-policy.ts` lines 5-18; `packages/core/src/routing/failure-classifier.ts` lines 10-17
**Apply to:** the class branch in `fetchUpstreamWithFallback` only

Do not use `shouldFallbackAfterStatus` or `retryDelayAfterStatus` to decide a class continuation or a bench until-time. Non-class requests still call both.

### Facts, not the dialog
**Source:** `packages/core/src/gateway/limits/window-limiter.ts` lines 52-81; `packages/core/src/routing/route-script-context.ts` lines 116-124
**Apply to:** `requestFacts` and `attemptsForClass`

`estimateLimitUsage` is the image count and the token estimate. Tool names are the route-script helper's shape. `attemptsForClass` receives the numbers and the names. It does not receive `messages`.

### Tests
**Source:** `packages/core/test/unit/class-switch/plan.test.mjs`; `packages/core/test/unit/class-switch/classify.test.mjs` lines 462-491
**Apply to:** `bench.test.mjs` and `choice.test.mjs`

`node:test` + `node:assert/strict`. Flat `test()`. Restore env in `finally`. Do not edit parent test files. Do not put tests under `packages/core/src/class-switch/`. Failing tests land before the implementation. Command: `npm run test:unit -w @claude-code-router/core`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | Every file in the classification table has an analog. The behaviors below have no function to copy. |

Behaviors with no function analog (use RESEARCH.md, not a second design):

| Behavior | Lives in | Why there is no analog |
|----------|----------|------------------------|
| Bench until-time parser | `bench.ts` | `parseRetryAfterHeaderMs` clamps through `retryDelayAfterStatus`. Groq `2m59.56s` and a 13-digit Unix millisecond value have no reader. RESEARCH.md Pattern 4. |
| Image lift out of `tool_result` | `plan.ts` | No function moves `image` / `image_url` / `input_image` blocks onto the parent content array. RESEARCH.md Pattern 7. Do not edit the gateway package. |
| Thin share 1-in-20 | `plan.ts` | No request counter rotates a near-tied row. Process-local integer. Tests set it. |
| Class continuation set | `executor.ts` | `shouldFallbackAfterStatus` is mode-based and treats 401, 403, and 404 as `client`. The class branch is the status list in the executor assignment. |
| `WeakSet` class mark | `seam.ts` | Nothing returns a caller's value through a side set. The closed `UpstreamAttempt` type is why the mark is not a field. |

## Metadata

**Analog search scope:** `packages/core/src/class-switch/`, `packages/core/src/gateway/upstream/executor.ts`, `packages/core/src/gateway/request/pipeline.ts`, `packages/core/src/routing/execution-plan.ts`, plus the tracked files named in the assignments
**Files scanned:** 3 class-switch sources, 5 edit targets, 24 tracked analogs read or ranged
**Pattern extraction date:** 2026-11-14

**Tracked analogs:** `catalog.ts`, `plan.ts`, `seam.ts`, `execution-plan.ts`, `executor.ts`, `pipeline.ts`, `retry-policy.ts`, `failure-classifier.ts`, `credential-pool.ts` (read, not edited), `probe.ts`, `window-limiter.ts`, `route-script-context.ts`, `context-archive.ts`, `model-catalog.ts`, `contracts/app.ts`, `shared.ts`, `contracts.ts`, `model-registry.ts`, `runtime-topology.ts`, `body.ts`, `error-detail.ts`, `model-discovery.ts`, `usage/store.ts`, `management-server.ts` (already wired, not edited), `plan.test.mjs`, `classify.test.mjs`, `upstream-executor.test.mjs`, `model-catalog-file.test.mjs`.

**Out of this phase:** `notice.ts`, `credential-pool.ts`, `catalog.ts`, `profiles/service.ts`, `config.ts`, `CUSTOM_ROUTER_PATH`, a field on `UpstreamAttempt` or `Router.fallback`, Sonnet or Haiku rows, Phase 3 headers `x-ccr-requested-model` / `x-ccr-served-model`.

# Phase 1: Shelves - Research

**Researched:** 2026-11-14
**Domain:** Claude class shelves, OpenRouter Artificial Analysis scores, provider model-list refresh, `/v1/models` context window
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md was generated with discuss skipped (`workflow.skip_discuss`). It has no locked implementation choices of its own. The product rules it points at are locked in `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/research/IMPORTED-DESIGN.md`, and `.planning/research/FORK-SEAMS.md`. Do not reopen those rules.

### Locked Decisions

Copied from `01-CONTEXT.md` `<decisions>`:

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

The discretion items this research locks for the planner are in **Architecture Patterns** below. They are the smallest reading of the roadmap that the current code can implement. Do not add a second design.

### Deferred Ideas (OUT OF SCOPE)

Copied from `01-CONTEXT.md` `<deferred>`:

None — discuss phase skipped.

Also out of this phase, from `.planning/REQUIREMENTS.md` and `.planning/research/FORK-SEAMS.md`:

- Bench, quota, tool and image filters, thin share, token rotation, and "unchecked ranks below confirmed" (Phase 2).
- Step-down, the swap notice, and `x-ccr-requested-model` / `x-ccr-served-model` (Phase 3).
- A review-queue approve or reject screen. A disagreed model waits. It is not shelved.
- Edits to `credential-pool.ts`, `profiles/service.ts`, `config.ts`, the request loop body, or `CUSTOM_ROUTER_PATH`.
- `bench.ts` and `notice.ts`. Do not create them in this phase.
- Ranking by price or parameter count.
- A new npm dependency.

### Locked product rules the planner must implement

Class names, from `.planning/research/IMPORTED-DESIGN.md`:

| Class | Request family |
|---|---|
| Fable | `claude-fable-…` |
| Opus | `claude-opus-…` |
| Sonnet | `claude-sonnet-…` |
| Haiku | `claude-haiku-…` |

- `best` is Opus.
- `opusplan` is not a CCR split. Claude sends Opus while planning and Sonnet while executing. CCR opens the class of the name that arrived.
- `opus[1m]` and `sonnet[1m]` stay in that class. A model whose window is under 1,000,000 tokens is dropped.

Score, from the same file:

- Field: OpenRouter `benchmarks.artificial_analysis`.
- Weights: `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20. A missing index divides the remaining weights by their sum.
- Cuts: Fable is 62 and above. Opus is 50 up to, but not including, 62. Sonnet is 28 up to, but not including, 50. Haiku is below 28.
- One index cannot place a model above Sonnet.
- No index, tier word in the id: `fable` / `astra`, `opus` / `sol`, `sonnet` / `terra`, `haiku` / `luna`. `flash`, `mini`, `nano`, and `lite` do not set a tier.
- No index and no tier word: no shelf. Same for `:batch` and non-text models.
- Score and tier word disagree by more than one step: review queue, not a shelf.
- A hex model id still gets a class from the score or from those words.

Catalog, from the same file and from FORK-SEAMS:

- Every 10 minutes, read each provider's model list. No text generation. A new name is classified. A missing name leaves the shelves.
- Code lives in `packages/core/src/class-switch/`. Parent files get only the seam calls. `CCR_CLASS_SWITCH=0` returns the parent result.
- Do not add a field to `UpstreamAttempt`. Do not add a key to `config.ts`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHELF-01 | A Claude class name opens that shelf. `best` is Opus. `opus[1m]` and `sonnet[1m]` stay in class and drop windows under 1,000,000. `/v1/models` reports the real context window. | `plan.ts` parses the name, including a hex route id via the existing decoder. The end of `createRouteExecutionPlan` replaces `attempts` with that shelf. The `[1m]` filter uses the window chain below. `createGatewayModelsResponse` adds `context_window` and `max_context_window` from that same chain. |
| SHELF-02 | Place a provider model from `benchmarks.artificial_analysis` with the locked weights, renormalization, cuts, one-index cap, and tier words. A hex id still classifies. | `catalog.ts` GETs `https://openrouter.ai/api/v1/models` and reads `benchmarks.artificial_analysis`. The checked-in `models.json` does not store that object. Match ids without splitting a slash model id. |
| SHELF-03 | No index and no tier word, `:batch`, and non-text stay off the shelves. A score/tier disagreement of more than one step waits in the review queue. | Same classifier. The queue is data in the shelf snapshot. No UI screen. |
| BACK-01 | Every 10 minutes, each enabled provider's model list refreshes with no text generation. New names are classified. Missing names leave the shelves. | `catalog.start()` / `catalog.stop()` from `startConfiguredServices` / `stopConfiguredServices`. List fetch uses `probeGatewayProvider` with `mode: "models"`. Do not use `mode: "connectivity"`. Do not delete rows from `provider.models`. |
</phase_requirements>

## Summary

Phase 1 adds `packages/core/src/class-switch/` and three parent calls. `catalog.ts` owns the shelf snapshot: score, tier word, exclusions, review queue, and the 10-minute model-list walk. `plan.ts` turns a Claude class name into the ordered models on that shelf. `seam.ts` is the only module parent files import. `CCR_CLASS_SWITCH=0` makes every seam return the parent value.

The parent already refreshes providers that set `autoFetchModels`, and it only adds names. It does not store OpenRouter benchmark scores, and its model-list parser keeps only the id and the display name. Shelves therefore need their own snapshot. Scores come from one public GET of `https://openrouter.ai/api/v1/models`, field `benchmarks.artificial_analysis`. That GET on 2026-11-14 returned 471 models, 210 of them with that object. `coding_index`, `agentic_index`, and `intelligence_index` are numbers or `null`. `null` is a missing index.

`/v1/models` is built by `createGatewayModelsResponse`. Claude Code's user agent gets the Anthropic-shaped branch, which already has `max_input_tokens` and `capabilities.context_window` when a window is known. Parent issue #1911 asked for top-level `context_window` and `max_context_window` because the response the reporter saw had neither, and Claude then assumes 200000. This phase adds those two numbers from the real window. It does not write 200000 as a default, and it does not call `claudeCodeEffectiveMaxInputTokens`, which caps a non-1m window at 200000 and is unused.

**Primary recommendation:** Implement the classifier and the shelf snapshot in `catalog.ts`, open the shelf from the end of `createRouteExecutionPlan`, and add the two context-window numbers at the end of `createGatewayModelsResponse`. Start the 10-minute walk from the management server, beside the existing auto-refresh, and do not merge the two walks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Class-name parse and shelf open | API / Backend | — | The model name arrives on the gateway request. `createRouteExecutionPlan` already builds `attempts` there. |
| Score, tier word, exclusions, review queue | API / Backend | — | Pure functions over provider model ids and the OpenRouter payload. No UI in this phase. |
| 10-minute model-list walk | API / Backend | — | The management server already owns `syncProviderModelAutoRefreshService` / `stopProviderModelAutoRefreshService`. The gateway child inherits `process.env`, so it can read a snapshot file under `resolveRuntimeDataDir()`. |
| Real context window on `/v1/models` | API / Backend | — | Both the compatibility pipeline and the child router plugin call `createGatewayModelsResponse`. One change there covers both servers. |
| Review queue display | — | — | Out of scope. The snapshot is the record. Phase 3 owns the only UI read, and that read is `notice.ts`. |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory, and no `.cursor/skills/` or `.agents/skills/` in this repo.

Conventions that do bind this phase, from `.planning/codebase/CONVENTIONS.md` and `.planning/codebase/TESTING.md` (mapped 2026-11-14):

- New source files are kebab-case. Domain types are `export type`, not `interface`.
- Tests are not colocated under `packages/*/src`. Core tests are `packages/core/test/unit/<domain>/*.test.mjs`, flat `test()` calls, `node:assert/strict`, import source paths with the `.ts` extension.
- `packages/core/tsconfig.json` uses `"rootDir": "src"`. A `.test.ts` under `src` would enter `tsc`. Do not put tests there.
- `workflow.tdd_mode` is `true` in `.planning/config.json`. Write the failing unit tests before the implementation.
- `workflow.nyquist_validation` is `true`. `security_enforcement` is absent, so the security section below applies.

FORK-SEAMS says "Tests live next to these files. Do not edit the parent's test files." The test runner only compiles `packages/core/test` (`build/test.mjs` `testDirs`). Put new tests in `packages/core/test/unit/class-switch/`. Do not edit existing parent test files. That satisfies the fork rule the runner can actually execute.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=22` (this machine: v22.23.2) | Runtime, global `fetch`, `node:test` | Root and `packages/core/package.json` `engines.node` are `>=22`. `[VERIFIED: package.json:26-28]` `[VERIFIED: packages/core/package.json:10-12]` |
| Existing `probeGatewayProvider` | in repo | Provider model-list GET | `mode: "models"` already lists models. `mode: "connectivity"` is the path that POSTs a chat `ping`. |
| Existing `decodeClaudeAppGatewayRouteId` | in repo | Hex gateway route ids | Parent PR #1593. The decoder already exists. Do not write a second hex codec. |
| Existing model registry | in repo | Attempt model string | `providerModelRef` builds `` `${provider.name}/${model}` ``. The model string is not parsed. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| OpenRouter `GET /api/v1/models` | live HTTP, no new package | `benchmarks.artificial_analysis` and `context_length` | Once per catalog tick. Not the hourly `models.json` CDN. |
| `node:test` + `node:assert/strict` | Node 22.23.2 | Unit tests | The only runner in this repo. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `GET /api/v1/models` field `benchmarks.artificial_analysis` | `GET /api/v1/benchmarks?source=artificial-analysis` | Do not use it. The locked field is on the model object. The benchmarks endpoint keys `model_permaslug`, requires a bearer token, and is rate-limited. `[CITED: https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks]` |
| Shelf snapshot file | A new `config.ts` key or a SQLite table | Forbidden. FORK-SEAMS: do not add a key to `config.ts`. |
| `claudeCodeEffectiveMaxInputTokens` | The real window chain | That helper caps a non-1m window at 200000 and has no callers. Do not call it. |

**Installation:**

```bash
# no packages
```

This phase installs nothing. The Package Legitimacy Gate is not run because there is no package to install.

## Package Legitimacy Audit

No external packages. Nothing to install, nothing removed, nothing flagged.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code
  |  POST /v1/messages  model=claude-opus-… | best | opus[1m] | anthropic/claude-ccr-h<hex>
  v
createRouteExecutionPlan
  |  seam.planForClass(name) when CCR_CLASS_SWITCH !== "0"
  |  not a class, switch off, or shelf empty --> parent attempts (off | retry | model-chain)
  v
attempts = shelf models, score high to low
  |
  v
parent fetchUpstreamWithFallback walks that list
  (bench, quota, tools, images, thin share, step-down are later phases)


management server startConfiguredServices
  |  catalog.start()
  |-- every 10 min, each enabled provider: probeGatewayProvider mode "models" (GET list, no chat ping)
  |-- one GET https://openrouter.ai/api/v1/models
  v
classify --> snapshot file under resolveRuntimeDataDir()/cache/
  |  shelves | excluded | review
  v
request process reads the snapshot (child env is a copy of process.env)

GET /v1/models
  createGatewayModelsResponse
    |  seam.applyContextWindows when switch is on
    v
  top-level context_window + max_context_window
  plus the parent's max_input_tokens and capabilities.context_window when that branch already has them
```

### Recommended Project Structure

```text
packages/core/src/class-switch/
├── catalog.ts    # fetch, classify, snapshot, 10-minute timer
├── plan.ts       # class name -> ordered shelf models, [1m] filter
└── seam.ts       # the only functions parent files call
packages/core/test/unit/class-switch/
├── classify.test.mjs
├── plan.test.mjs
└── context-window.test.mjs
```

Do not create `bench.ts` or `notice.ts` in this phase.

### Pattern 1: Kill switch and parent seams

**What:** Three parent edits. Every seam returns immediately when `process.env.CCR_CLASS_SWITCH === "0"`.

**When to use:** All phase 1 behavior.

**Parent calls:**

| Parent file | Call | This phase |
|-------------|------|------------|
| `packages/core/src/routing/execution-plan.ts`, end of `createRouteExecutionPlan` | Replace `attempts` only when the name is a class and the shelf is non-empty | Yes |
| `packages/core/src/web/management-server.ts` `startConfiguredServices` / `stopConfiguredServices` | `catalog.start()` / `catalog.stop()` | Yes |
| `packages/core/src/gateway/features/model-discovery.ts`, end of `createGatewayModelsResponse` | Fill real context-window numbers | Yes. This file is outside the FORK-SEAMS allowlist. It is required because both servers call this one function. Do not copy the fill into `pipeline.ts` and `router-plugin.ts`. |

Do not edit `executor.ts`, `pipeline.ts`, `credential-pool.ts`, `config.ts`, `profiles/service.ts`, or the UI in this phase.

`createRouteExecutionPlan` today returns the parent plan and nothing else. The seam is the last statement: build the parent plan as now, then replace `attempts` only for a class shelf that has at least one resolvable model.

```8:14:packages/core/src/routing/execution-plan.ts
export function createRouteExecutionPlan(input: {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
}): RouteExecutionPlan {
```

An empty shelf returns that parent plan unchanged. Step-down is Phase 3. An empty attempt list here would error Claude before that phase exists.

The attempt model string is the registry's selector, built the way `providerModelRef` already builds it. Do not split the model id on `/`.

```213:216:packages/core/src/routing/model-registry.ts
function providerModelRef(provider: GatewayProviderConfig, model: string, selector: string): RouteModelRef {
  return {
    canonicalSelector: `${provider.name}/${model}`,
    kind: "provider",
```

Do not add fields to `UpstreamAttempt`:

```182:192:packages/core/src/gateway/internal/shared.ts
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

### Pattern 2: Class name parser

**What:** Decide the shelf from the whole model string Claude sent.

**Steps:**

1. Trim. If `decodeClaudeAppGatewayRouteId` returns a string, replace the name with that string and continue. The existing decoder is the hex route id `anthropic/claude-ccr-h` plus hex, optional variant `anthropic/claude-ccr<N>-h`.

```319:321:packages/core/src/agents/claude-app/gateway-routes.ts
export function decodeClaudeAppGatewayRouteId(routeId: string): string | undefined {
  const normalized = stripClaudeAppGatewayOneMillionContextSuffix(routeId).toLowerCase();
  const match = /^anthropic\/claude-ccr(?:\d+)?-h([0-9a-f]+)$/.exec(normalized);
```

Parent PR #1593: Claude sends that hex id when the target is not a native `claude-…` name. A hex blob does not contain `opus` or `sonnet`. Decode first, then parse. Do not write a second decoder.

2. If the name ends with `[1m]` (case-insensitive), set the 1m filter and remove that suffix. The existing strip is `/\[1m\]$/i`.

```129:131:packages/core/src/agents/claude-app/gateway-routes.ts
export function stripClaudeAppGatewayOneMillionContextSuffix(id: string): string {
  return id.trim().replace(/\[1m\]$/i, "").trim();
}
```

3. Match the remaining whole string, case-insensitive:

| Remaining name | Class | 1m filter |
|---|---|---|
| `best` exactly | Opus | no, unless step 2 already stripped `[1m]` |
| `claude-fable`, `claude-opus`, `claude-sonnet`, or `claude-haiku`, then end or a non-alphanumeric | that class | from step 2 |
| `opus`, `sonnet`, `fable`, or `haiku` exactly, and step 2 stripped `[1m]` | that class | yes |

The boundary stops `claude-opusplan` from matching Opus (`p` is alphanumeric). `best-model` is not `best`. A bare `opus` without `[1m]` is not a class request: it can be a configured model id. The literal `opusplan` is not a class.

4. A decoded `Provider/some-model` is not a class name. Do not take the segment after the first slash. FORK-SEAMS forbids that parser. Phase 2 owns "a slash id still runs the policy" for non-class traffic.

5. Not a class, or the switch is off: return the parent plan.

### Pattern 3: Shelf order for a class request

**What:** When the shelf has models, replace `attempts`.

**Order:** scored models first, score descending. Tier-word models (no score) after them. Tie: `provider` then `model`, `localeCompare`. Phase 2 will later insert bench, quota, tools, images, and the thin share. Do not add those filters now.

**1m filter:** keep a model only when its window is a finite number `>= 1_000_000`. An unknown window is dropped. Do not assume 200000 or 1000000.

**Unresolvable model:** if `modelRegistry.resolve` does not return a provider target for `` `${provider.name}/${model}` ``, skip that row. If none remain, return the parent plan.

### Pattern 4: Classifier

**What:** One function. Input is the provider name, the model id as stored on that provider, the matched OpenRouter model object (or none), and the window. Output is `shelf`, `excluded`, or `review`.

**Score.** Read only `benchmarks.artificial_analysis`. A present index is a finite number. `null`, absent, and non-finite are missing.

```text
weights = coding_index 0.50, agentic_index 0.30, intelligence_index 0.20
score = sum(weight * value) / sum(weight)   for present indexes only
no present index -> no score
```

Cuts, after the score exists:

| Score | Class |
|---|---|
| `>= 62` | Fable |
| `>= 50` and `< 62` | Opus |
| `>= 28` and `< 50` | Sonnet |
| `< 28` | Haiku |

If exactly one index is present and that class is Fable or Opus, the class becomes Sonnet. Haiku and Sonnet stay.

**Tier word.** Split the id on every character that is not `[a-z0-9]`. Compare whole tokens, case-insensitive. Do not match inside a longer token (`sol` does not match `console`).

| Token | Class |
|---|---|
| `fable`, `astra` | Fable |
| `opus`, `sol` | Opus |
| `sonnet`, `terra` | Sonnet |
| `haiku`, `luna` | Haiku |

Ignore tokens `flash`, `mini`, `nano`, `lite`. They never set a class and they never count as a disagreement.

Two or more tier classes: if the distance is more than one step, the result is the review queue even when there is no score. If the distance is one step, use the higher class (Fable above Opus above Sonnet above Haiku).

**Both a score class and a tier class.** Compare after the one-index cap. Distance is steps on Fable–Opus–Sonnet–Haiku.

- Distance 0 or 1: shelf the score class.
- Distance greater than 1: review queue. Do not shelf.

**Neither:** excluded, reason `no-index`.

**`:batch`.** If any `:` segment of the id is `batch` (case-insensitive), excluded, reason `batch`. This wins over a score. Do not exclude `:free`, `:nitro`, `:floor`, `:exacto`, or `:online`. OpenRouter documents `:batch` as a catalog variant with its own id. `[CITED: https://openrouter.ai/docs/guides/routing/model-variants/overview]`

**Non-text.** Exclude, reason `non-text`, when any of these is true:

- Output modalities are known and do not include `text`.
- `architecture.modality` has an output side (after `->`) and that side does not include `text`, or it includes `image`, `audio`, or `video`.
- An id token is `embed`, `embedding`, `whisper`, `tts`, `ocr`, `rerank`, or `moderation`.

Image input with text-only output stays eligible. That is a vision chat model. The live list on 2026-11-14 had no output list that lacked `text` (452 `text`, 13 `image+text`, 4 `audio+text`, 2 `text+video`). The rule still drops those image, audio, and video outputs.

**Hex provider model ids.** Do not drop an id because it fails `claudeAppGatewayNativeModelNameIsSafe` or because it has no letters. Run the score match and the token scan. A hex id with a score is shelved. A hex id with no score and no tier token is `no-index`.

**Worked fixtures (inline numbers, not a live call).** Observed on `GET https://openrouter.ai/api/v1/models` this session. Tests must embed these objects. They must not fetch OpenRouter.

| Model | Indexes | Result |
|---|---|---|
| `cohere/command-a-plus` | coding 27.8, agentic 1, intelligence 6.2 | score 15.44, Haiku |
| `motif-technologies/motif-3` | coding 63.5, agentic 28.4, intelligence `null` | score 50.3375, two indexes, Opus |
| `google/gemini-4-hydrogen` | intelligence 53.9 only | score 53.9 would be Opus; one index caps it at Sonnet |
| `inclusionai/ling-3.2-flash:free` | no `benchmarks` object; token `flash` is not a tier | excluded `no-index` |
| `google/gemini-4-hydrogen:batch` | whatever the base score is | excluded `batch` |

`gemini-4-hydrogen` plus a tier token `opus` is distance 1 after the cap (Sonnet vs Opus): shelf Sonnet. The same id plus a tier token `fable` is distance 2: review queue.

### Pattern 5: OpenRouter match

**What:** Attach at most one OpenRouter row to a provider model.

**Order:**

1. Case-insensitive equality with `id` or `canonical_slug`.
2. If the provider model id contains no `/`, and exactly one OpenRouter row has a final path segment equal to that id, use that row. Two rows means no match. Do not pick the higher score.

Do not call `GET /api/v1/benchmarks`.

Fetch: `GET https://openrouter.ai/api/v1/models` with `accept: application/json` and no body. This session's unauthenticated GET returned 200 and `data.length === 471`. The published docs say `Authorization` is required and show 401 without it. `[CITED: https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties]` On 401, retry once with the API key of an enabled provider whose base URL host is `openrouter.ai`, using the same header shape as `probe.ts` (`Bearer` unless the key already has that prefix). Do not add a config key. On any failure, keep the previous score table. Do not empty shelves because the score fetch failed.

`scripts/generate-models-json.mjs` `ingestOpenRouter` copies context and modalities. It does not copy `benchmarks`. A repo search of `packages/core/models.json` found no `benchmarks` key. The hourly CDN catalog uses that same schema (`catalog-file.ts` checks `schemaVersion === 2` only). Do not read scores from `models.json`.

### Pattern 6: Context window

**What:** One number, used by the `[1m]` filter and by `/v1/models`.

**First match wins:**

1. Provider `modelMetadata` for that model: `contextWindow` or `maxContextWindow`, then the effective percent. `contextWindowPinned` forces 100. Otherwise use `effectiveContextWindowPercentFor`.

```246:254:packages/core/src/contracts/app.ts
export function effectiveContextWindowPercentFor(metadata: ProviderModelMetadata | undefined): number | undefined {
  if (metadata?.contextWindowPinned) {
    return 100;
  }
  const percent = metadata?.effectiveContextWindowPercent;
  return percent !== undefined && Number.isFinite(percent) && percent > 0 && percent <= 100
    ? percent
    : undefined;
}
```

```420:426:packages/core/src/gateway/features/model-discovery.ts
function effectiveProviderContextWindow(metadata: ProviderModelMetadata | undefined): number | undefined {
  const contextWindow = positiveInteger(metadata?.contextWindow) ?? positiveInteger(metadata?.maxContextWindow);
  if (!contextWindow) {
    return undefined;
  }
  const effectivePercent = effectiveContextWindowPercentFor(metadata) ?? 100;
  return Math.max(1, Math.floor((contextWindow * effectivePercent) / 100));
}
```

The 1,000,000 comparison already used for `[1m]` discovery:

```214:219:packages/core/src/agents/claude-app/gateway-routes.ts
  const contextWindow = positiveInteger(metadata?.contextWindow) ?? positiveInteger(metadata?.maxContextWindow);
  if (!contextWindow) {
    return undefined;
  }
  const effectivePercent = effectiveContextWindowPercentFor(metadata) ?? 100;
  return Math.floor((contextWindow * effectivePercent) / 100) >= 1_000_000;
```

2. `modelCatalogMaxInputTokens` on `findProviderModelCatalogEntry`, else `findModelCatalogEntry`. Use the number only when it is `> 0`.

```156:161:packages/core/src/gateway/model-catalog.ts
export function modelCatalogMaxInputTokens(entry: ModelCatalogEntry | undefined): number {
  return Math.max(
    0,
    entry?.limits?.contextTokens ?? 0,
    entry?.limits?.inputTokens ?? 0
  );
}
```

3. The matched OpenRouter row: `context_length`, else `top_provider.context_length`, when that value is a positive finite number. The live sample for `motif-technologies/motif-3` was `context_length: 262144`.

Do not call this helper. It is the 200000 cap, and nothing in the repo calls it:

```5:5:packages/core/src/gateway/model-catalog.ts
const claudeCodeDefaultContextTokens = 200_000;
```

```164:169:packages/core/src/gateway/model-catalog.ts
export function claudeCodeEffectiveMaxInputTokens(entry: ModelCatalogEntry | undefined, oneMillionContext: boolean): number {
  const maxInputTokens = modelCatalogMaxInputTokens(entry);
  if (oneMillionContext) {
    return maxInputTokens || 1_000_000;
  }
  return maxInputTokens > 0 ? Math.min(maxInputTokens, claudeCodeDefaultContextTokens) : 0;
}
```

`claudeCodeUnknownModelDefaultContextWindow` is also 200000. It only decides whether a compact-window map gets an extra `[1m]` key. Do not use it as a model's window.

```291:291:packages/core/src/gateway/features/model-discovery.ts
const claudeCodeUnknownModelDefaultContextWindow = 200_000;
```

**`/v1/models` fill,** only when the switch is on and a window was found:

- Set top-level `context_window` and `max_context_window` to that integer on every model object in `data`. Parent issue #1911 asked for those two names. The reporter's client assumed 200000 when they were absent. `[CITED: https://github.com/musistudio/claude-code-router/issues/1911]`
- On the Anthropic-shaped branch, also set `max_input_tokens`, `capabilities.context_window.max_input_tokens`, and `capabilities.context_management.max_input_tokens` when those objects already exist. Do not remove fields the parent already sends.
- On the OpenAI-shaped branch, add only the two top-level numbers. That branch currently has no window at all:

```228:238:packages/core/src/gateway/features/model-discovery.ts
function createOpenAICompatibleGatewayModelsResponse(config: AppConfig, profile?: ProfileConfig): Record<string, unknown> {
  const data = buildGatewayDiscoverableModelIds(config, profile).map((id) => {
    const catalogEntry = findModelCatalogEntry(id);
    return {
      id,
      object: "model",
      created: 0,
      owned_by: gatewayModelOwner(id),
      type: "model",
      ...(catalogEntry?.displayName ? { display_name: catalogEntry.displayName } : {})
    };
  });
```

When the window is unknown, leave the parent fields unchanged. Do not write 200000.

Claude Code is the Anthropic branch: `isClaudeCodeUserAgent` is true when the user agent contains `claude`.

```111:114:packages/core/src/gateway/features/model-discovery.ts
  if (isClaudeCodeUserAgent(headers)) {
    return createClaudeAppGatewayModelsResponse(config, { claudeCode: true, contextArchiveCompact, profile });
  }
  return createOpenAICompatibleGatewayModelsResponse(config, profile);
```

The default capability object omits `context_window` when `maxInputTokens` is not a positive integer. That is the hole #1911 describes. Filling a known window closes it. Inventing a window does not.

```812:820:packages/core/src/gateway/features/model-discovery.ts
    ...(maxInputTokens
      ? {
          context_window: {
            max_input_tokens: maxInputTokens,
            one_million_context_variant: options.oneMillionContext === true,
            supported: true,
            supports_1m_context: maxInputTokens >= 1_000_000
          }
        }
      : {}),
```

Issue #1911 also says Claude Code 2.1.306's discovery cache stored only `id` and `display_name`. Emitting the fields is this phase's job. Writing `CLAUDE_CODE_MAX_CONTEXT_TOKENS` into the Claude settings file is not. That file is the settings door.

### Pattern 7: Catalog walk

**What:** `catalog.start()` schedules the first walk at delay 0, then every `10 * 60 * 1000` ms with `unref()`, same shape as the parent timer. `catalog.stop()` clears the timer. The switch off means `start` does not schedule and does not fetch.

Parent interval, for the value only. Do not change that module:

```25:25:packages/core/src/providers/model-auto-refresh.ts
export const providerModelAutoRefreshIntervalMs = 10 * 60 * 1000;
```

Call site: `startConfiguredServices` already calls `syncProviderModelAutoRefresh(config)` at the end. Call `catalog.start()` there. `stopConfiguredServices` already calls `stopProviderModelAutoRefreshService()`. Call `catalog.stop()` there.

```513:520:packages/core/src/web/management-server.ts
    syncProviderModelAutoRefresh(config);
  } catch (error) {
    console.error(`Failed to start configured services during ${reason}: ${formatError(error)}`);
  }
}

async function stopConfiguredServices(): Promise<void> {
  stopProviderModelAutoRefreshService();
```

The child gateway copies `process.env` (`createGatewayProcessEnv` starts with `...process.env`), so `CCR_INTERNAL_USER_DATA_DIR` is the same process environment the snapshot path uses.

**Which providers:** every provider where `isGatewayProviderEnabled` is true and a base URL is set.

```189:191:packages/core/src/contracts/app.ts
export function isGatewayProviderEnabled(provider: Pick<GatewayProviderConfig, "enabled">): boolean {
  return provider.enabled !== false;
}
```

The parent walk skips providers that do not set `autoFetchModels`, and it only adds names:

```116:148:packages/core/src/providers/model-auto-refresh.ts
    if (!provider.autoFetchModels || !isGatewayProviderEnabled(provider)) {
      continue;
    }
    // ...
      const knownModels = mergeModelLists(provider.autoFetchKnownModels ?? [], provider.models);
      const hasKnownModelBaseline = Boolean(provider.autoFetchKnownModels?.length);
      const addedModels = hasKnownModelBaseline ? modelsNotIn(knownModels, fetchedModels) : [];
      const mergedModels = mergeModelLists(provider.models, addedModels);
```

Do not edit `model-auto-refresh.ts`. Do not remove names from `provider.models`. Shelf membership is the shelf snapshot, not the config list. A name absent from the latest successful fetch for that provider leaves the shelves. A failed fetch for that provider keeps its previous name list.

**No text generation.** `mode: "models"` GETs `/models` (or the provider's model endpoint) and then POSTs an empty body for protocol support. The chat `ping` is only `mode: "connectivity"` (`max_tokens` and `messages: [{ content: "ping" }]` in `probeProtocolConnectivity`). Call `probeGatewayProvider` with `mode: "models"` and `forceRefresh: true`. Never call `mode: "connectivity"` from this walk.

`parseModelList` keeps ids and display names only. It does not keep `context_length` or benchmarks. Take the id list from the probe. Take scores and OpenRouter windows from the OpenRouter GET, not from the probe payload.

**Snapshot file:** `path.join(resolveRuntimeDataDir(), "cache", "class-switch-shelves.json")`. The models catalog cache is the sibling file:

```23:24:packages/core/src/models/catalog-file.ts
export function modelCatalogCachePath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "models.json");
}
```

Write with a temp file and `rename`, as `downloadModelCatalog` does. A corrupt or missing snapshot on the request path means "no shelf": return the parent plan. Do not throw.

**Snapshot shape the tests assert:**

```ts
export type ShelfClass = "fable" | "opus" | "sonnet" | "haiku";

export type ShelfRow = {
  provider: string;
  model: string;
  contextWindow?: number;
  score?: number;
  tierClass?: ShelfClass;
};

export type ShelfSnapshot = {
  excluded: Array<ShelfRow & { reason: "batch" | "no-index" | "non-text" }>;
  review: Array<ShelfRow & { reason: "score-tier-disagree"; scoreClass: ShelfClass; tierClass: ShelfClass }>;
  shelves: Record<ShelfClass, ShelfRow[]>;
  updatedAt: string;
};
```

Before the first successful fetch, classify `provider.models` so a class request works at startup. The first tick still runs at once.

The parent auto-refresh keeps running. Providers with `autoFetchModels` get two list GETs per 10 minutes. Leave that. Merging the walks would edit `model-auto-refresh.ts`.

### Anti-Patterns to Avoid

- **A second policy call inside the request loop.** The attempt list is built once.
- **Editing `provider.models` from the shelf walk.** The parent list is append-only on purpose. Shelf departure is the snapshot.
- **Using `models.json` or `GET /api/v1/benchmarks` for the score.** The locked field is `benchmarks.artificial_analysis` on the models list.
- **Calling `claudeCodeEffectiveMaxInputTokens` or writing 200000** when the window is unknown.
- **Treating `flash` / `mini` / `nano` / `lite` as tiers,** or matching tier words as substrings.
- **Shelving a one-step disagreement on the tier word.** The score class wins. A larger gap goes to review.
- **Returning an empty attempt list** for an empty shelf in this phase.
- **Colocating `*.test.*` under `packages/core/src/class-switch/`.** The runner will not execute them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider model list HTTP | A new client per protocol | `probeGatewayProvider({ mode: "models", forceRefresh: true })` | Protocol URLs, auth headers, and Gemini method filters already live in `probe.ts`. |
| 10-minute timer | A cron dependency | `setTimeout` + `unref`, cleared on stop | The parent timer is this shape. |
| Hex route ids | A new hex parser | `decodeClaudeAppGatewayRouteId` | PR #1593 ids are `anthropic/claude-ccr-h` + hex of the target. |
| Context percent | A new formula | `effectiveContextWindowPercentFor` and the floor multiply already in `effectiveProviderContextWindow` | Pinned windows and the 1m check must match discovery. |
| Slash model ids | `split("/")` | `` `${provider.name}/${model}` `` passed to the registry | OpenRouter and NVIDIA ids contain a slash. |
| Score source | `/api/v1/benchmarks` or `models.json` | `GET /api/v1/models` field `benchmarks.artificial_analysis` | The other endpoint is a different key and needs a key. The catalog file drops the field. |
| Review UI | A screen or an IPC method | The snapshot's `review` array | v1 has no approve/reject. |

**Key insight:** The shelf is a derived snapshot. The parent config list, the static model catalog, and the request loop stay the parent's.

## Common Pitfalls

### Pitfall 1: The 200000 cap that nothing calls

**What goes wrong:** `[1m]` drops a 1,050,000-token model, or `/v1/models` reports 200000.
**Why it happens:** `claudeCodeEffectiveMaxInputTokens` applies `Math.min(maxInputTokens, 200_000)` unless the 1m flag is already set.
**How to avoid:** Use the window chain in Pattern 6. Do not call that helper.
**Warning signs:** A fixture with `contextWindow: 272000` comes back as 200000.

### Pitfall 2: `null` treated as a real index

**What goes wrong:** A model with one real index and two nulls is scored as three indexes, or the one-index cap is skipped.
**Why it happens:** The live payload sets missing indexes to `null`, not by omitting the key. `motif-3` has `intelligence_index: null` and two numbers.
**How to avoid:** Only `Number.isFinite` counts as present.
**Warning signs:** `motif-3` is not Opus, or `gemini-4-hydrogen` is Opus.

### Pitfall 3: One-index cap applied after the disagreement check

**What goes wrong:** A one-index score of 53.9 plus a `fable` token is shelved as Opus or Fable.
**Why it happens:** The raw score is Opus, two steps from Fable, but the cap moves the score class to Sonnet first. Sonnet vs Fable is still more than one step, so the row waits in review. Sonnet vs `opus` is one step and shelves as Sonnet.
**How to avoid:** Cap, then measure distance, then shelf the score class.
**Warning signs:** A one-index model appears on Fable or Opus.

### Pitfall 4: The parent refresh looks like shelf removal

**What goes wrong:** A model deleted upstream stays on the shelf, or a shelf walk deletes it from `config.json` / SQLite.
**Why it happens:** `refreshAutoFetchProviderModels` unions fetched ids into `provider.models` and never subtracts. It also ignores providers with `autoFetchModels` unset.
**How to avoid:** Classify the ids from this phase's own probe. Write only the snapshot.
**Warning signs:** A removed upstream id is still in `shelves`, or `provider.models` shrinks after a tick.

### Pitfall 5: Connectivity probe during the catalog tick

**What goes wrong:** The 10-minute walk spends quota on `ping`.
**Why it happens:** `probeProtocols` uses `probeProtocolConnectivity` when `mode === "connectivity"`.
**How to avoid:** `mode: "models"` only.
**Warning signs:** A test double sees a POST body containing `"ping"`.

### Pitfall 6: Failed score fetch clears shelves

**What goes wrong:** OpenRouter 401 or a timeout unshelves every model.
**Why it happens:** The docs require a bearer token; this session's GET did not. The next environment may 401.
**How to avoid:** Keep the previous snapshot's scores and rows when the score GET fails. A failed provider list keeps that provider's previous ids.
**Warning signs:** Shelves go empty after one failed tick while `provider.models` is unchanged.

### Pitfall 7: Hex class names parsed as hex text

**What goes wrong:** `claude-opus-…` sent as `anthropic/claude-ccr-h…` does not open Opus, or a hex provider model id is skipped before scoring.
**Why it happens:** The hex alphabet has no tier word. `claudeAppGatewayNativeModelNameIsSafe` rejects non-Claude ids and the route layer encodes them.
**How to avoid:** Decode route ids with the existing function before the class test. Classify provider ids with no character-class filter.
**Warning signs:** A unit fixture from PR #1593 (`anthropic/claude-ccr-h` + hex of `claude-opus-4-6`) does not open Opus.

### Pitfall 8: Tests under `src/class-switch`

**What goes wrong:** `npm run test:unit` never runs the new tests.
**Why it happens:** `build/test.mjs` compiles `packages/core/test` only.
**How to avoid:** `packages/core/test/unit/class-switch/*.test.mjs`.
**Warning signs:** The suite is green and the new file is absent from `.test-dist/core/test/unit/class-switch/`.

## Code Examples

### Classifier core

Prescribed implementation. Weights and cuts are the locked design. The `null` rule is from the live models payload (Pattern 4).

```ts
const WEIGHTS = { coding_index: 0.50, agentic_index: 0.30, intelligence_index: 0.20 } as const;
type IndexName = keyof typeof WEIGHTS;

export function scoreArtificialAnalysis(indexes: Partial<Record<IndexName, unknown>>): { present: number; score: number } | undefined {
  const present = (Object.keys(WEIGHTS) as IndexName[]).filter((name) => Number.isFinite(indexes[name]));
  if (present.length === 0) return undefined;
  const weightSum = present.reduce((sum, name) => sum + WEIGHTS[name], 0);
  const score = present.reduce((sum, name) => sum + WEIGHTS[name] * Number(indexes[name]), 0) / weightSum;
  return { present: present.length, score };
}

export function classForScore(score: number, present: number): "fable" | "opus" | "sonnet" | "haiku" {
  const raw = score >= 62 ? "fable" : score >= 50 ? "opus" : score >= 28 ? "sonnet" : "haiku";
  return present === 1 && (raw === "fable" || raw === "opus") ? "sonnet" : raw;
}
```

### Shelf snapshot write

Copy the atomic write in `downloadModelCatalog`: write `class-switch-shelves.json.<uuid>.tmp` in the same directory, then `rename`.

### Context-window fill

After `createGatewayModelsResponse` has built the parent object, and only when `CCR_CLASS_SWITCH !== "0"`:

```ts
if (windowTokens) {
  row.context_window = windowTokens;
  row.max_context_window = windowTokens;
}
```

Leave `row` untouched when `windowTokens` is unknown.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/v1/models` entries with only `id`, `display_name`, `type`, `created_at` | This fork's Anthropic branch already sends `max_input_tokens` and `capabilities.context_window` when a window is known | Parent issue #1911, 2026-10-22, against the 3.1.3 bundle the reporter ran | Still add top-level `context_window` and `max_context_window`. Do not assume the nested field is what #1911 asked for. |
| Custom router rules matched `body.model` text | Hex route ids need `decodeClaudeAppGatewayRouteId` before a class test | Parent PR #1593, 2026-07-27 | Class parse decodes first. Do not decode by rewriting `body.model` inside the loop. |
| OpenRouter scores only via a separate benchmarks API | Model objects include `benchmarks.artificial_analysis` | Confirmed on the live models list, 2026-11-14 | Read the model object. Do not add the benchmarks endpoint. |

**Deprecated/outdated:**

- `GET /api/v1/benchmarks` as the score source for this phase. It exists and returns the same index names, on `model_permaslug`, with a required key. It is not the locked field.
- `:online` as a model-list variant. OpenRouter marks it deprecated. This phase does not special-case it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A one-step score/tier disagreement shelves the score class (after the one-index cap). The tier word does not win. | Pattern 4 | A model the user expected on the tier-word shelf appears one class away. Distance greater than 1 still stays in review either way. |
| A2 | Output that includes `image`, `audio`, or `video` is non-text. Image input with text-only output stays eligible. | Pattern 4 | A text+image generator the user wanted on a shelf stays off. A vision chat model stays on. |
| A3 | An unauthenticated models GET may keep working. On 401, retry with an existing OpenRouter provider key. | Pattern 5 | A host that always 401s, and has no OpenRouter provider configured, never scores. Tier words and exclusions still run. Shelves do not clear. |
| A4 | An empty class shelf leaves the parent attempt list in place until Phase 3. | Pattern 1 | A class with no models follows `off` / `retry` / `model-chain` instead of failing closed. Phase 3 replaces this branch. |
| A5 | Bare `opus` / `sonnet` / `haiku` / `fable` are not class requests. The same words with `[1m]`, and `claude-<class>…`, are. | Pattern 2 | A user who sends the bare word `opus` does not open the Opus shelf. |
| A6 | Tier-word models sort after scored models in the same class. | Pattern 3 | Phase 2 changes order again when it adds the live-triple rules. |
| A7 | Tests live in `packages/core/test/unit/class-switch/`, not beside `src/class-switch/`. | Project Constraints | A literal reading of FORK-SEAMS would put tests where `build/test.mjs` never compiles them. |

**If this table is empty:** N/A. The rows above are the discretion choices. The weights, cuts, tier words, `:batch`, the 10-minute walk, and the fork placement are locked, not assumed.

## Open Questions

1. **Will the installed Claude Code binary read `context_window`?**
   - What we know: Issue #1911 says 2.1.306's discovery cache kept `id` and `display_name` only, and the status line assumed 200000. The expected CCR change is to emit `context_window` and `max_context_window`.
   - What's unclear: Whether the user's current Claude Code build stores those fields.
   - Recommendation: Emit them. Do not write Claude settings. Record a manual check in the plan: `GET /v1/models` with a Claude user agent returns the configured window, not 200000.

2. **Two list GETs for `autoFetchModels` providers.**
   - What we know: The parent timer and this timer both run every 10 minutes.
   - What's unclear: Nothing functional. The cost is extra GETs.
   - Recommendation: Accept it. Do not edit `model-auto-refresh.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime and `node:test` | ✓ | v22.23.2 (`engines` `>=22`) | — |
| npm | `npm run test:unit` | ✓ | 12.2.2 | — |
| `https://openrouter.ai/api/v1/models` | Scores and `context_length` | ✓ this session (HTTP 200, 471 models, no bearer token) | — | On failure, keep the previous score table. Tier words still classify. |
| Provider model-list endpoints | BACK-01 | Depends on the user's providers | — | A failed provider keeps its previous shelf ids. |

**Missing dependencies with no fallback:**

- None for the code. A machine with no provider keys can still run the unit tests, which use fixtures.

**Missing dependencies with fallback:**

- OpenRouter unreachable: previous scores stay. New models without a tier word wait as `no-index` until a later tick.

Graph note: `gsd_run graphify status` reported `commit_stale: true` (built at `adfb273`, HEAD `d0d32d6`, 9 commits behind) and `stale: false`. The graph was used only to confirm `refreshAutoFetchProviderModels` sits in `model-auto-refresh.ts`. Line-level claims above come from `Read`, not from the graph.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (Node v22.23.2). No Jest or Vitest. |
| Config file | `build/test.mjs` compiles. `build/run-tests.mjs` runs `.test-dist/<project>/test/**/*.js`. |
| Quick run command | `npm run test:unit -w @claude-code-router/core` |
| Full suite command | `npm run test:core` |

`workflow.tdd_mode` is `true`. The first task writes `packages/core/test/unit/class-switch/*.test.mjs` and sees them fail, then implements.

The quick command runs every compiled core unit test. That is the project command. `build/run-tests.mjs` has no file filter. It also sets `HOME` and `CCR_INTERNAL_*` to a temp directory, which the snapshot writer needs.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELF-01 | `best` opens Opus. `claude-opus-…` / `claude-sonnet-…` / `claude-fable-…` / `claude-haiku-…` open that class. `claude-opusplan` does not. `opus[1m]` drops a window under 1,000,000 and an unknown window. Hex route id of `claude-opus-4-6` opens Opus. Switch `0` keeps the parent plan. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| SHELF-01 | `/v1/models` sets `context_window` and `max_context_window` from metadata 272000, not 200000. Unknown window does not add 200000. Switch `0` does not add the fields. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| SHELF-02 | Fixtures in Pattern 4: 15.44 Haiku, 50.3375 Opus, one-index 53.9 Sonnet. `gpt-5.6-sol` with no indexes is Opus. `flash` does not set a class. A hex id with a score is shelved. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| SHELF-03 | No index and no tier word, `:batch`, and image/audio/video output are excluded. Distance greater than 1 is `review` and absent from `shelves`. Distance 1 is shelved on the score class. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| BACK-01 | A new id is classified. An id missing from a successful fetch leaves the shelf. A failed fetch keeps it. The probe mock is called with `mode: "models"` and never sees a `ping` body. Switch `0` does not start the timer. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |

No manual-only tests. Do not add a live OpenRouter test.

### Sampling Rate

- **Per task commit:** `npm run test:unit -w @claude-code-router/core`
- **Per wave merge:** `npm run test:core`
- **Phase gate:** `npm run test:core` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/core/test/unit/class-switch/classify.test.mjs` — SHELF-02, SHELF-03, BACK-01 classifier and snapshot
- [ ] `packages/core/test/unit/class-switch/plan.test.mjs` — SHELF-01 class parse, `[1m]`, hex route, kill switch, empty shelf
- [ ] `packages/core/test/unit/class-switch/context-window.test.mjs` — SHELF-01 `/v1/models` fields
- [ ] Framework install: none. `node:test` is already the runner.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new login. Provider keys stay in the existing probe headers. |
| V3 Session Management | no | No new session. |
| V4 Access Control | no | No new route. The shelf file is local user data, same trust as `models.json`. |
| V5 Input Validation | yes | Model ids and the OpenRouter JSON are untrusted. Accept a score only with `Number.isFinite`. Ignore unknown keys. Do not eval ids. A bad snapshot falls back to the parent plan. |
| V6 Cryptography | no | Do not hash or encrypt the snapshot. Hex route ids use the existing `Buffer` decoder. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OpenRouter or a provider model list carries unexpected types | Tampering | Parse the three indexes, `context_length`, modalities, and ids. Drop the rest. |
| Shelf file edited on disk to point a class at an arbitrary model | Tampering | Atomic replace. On read, accept only the snapshot shape. Request path falls back to the parent plan when the file is invalid. |
| API key written into the snapshot or a log line | Information disclosure | The snapshot stores provider name, model id, score, tier, window, and reason. It does not store keys. Do not log the Authorization header. |
| Catalog tick sends a chat completion | Denial of wallet | `mode: "models"` only. Tests reject a `ping` body. |
| Class parser treats a configured model id as a class and redirects traffic | Spoofing | Match the whole string with the boundary rules in Pattern 2. Do not match substrings. |

## Sources

### Primary (HIGH confidence)

- Live `GET https://openrouter.ai/api/v1/models` on 2026-11-14: 471 models, 210 with `benchmarks.artificial_analysis` keys `intelligence_index`, `coding_index`, `agentic_index` (number or `null`). `:batch` ids exist. `packages/core/models.json` has no `benchmarks` key.
- Repo reads cited by path and line above: `execution-plan.ts`, `model-registry.ts`, `model-discovery.ts`, `model-catalog.ts`, `model-auto-refresh.ts`, `probe.ts`, `gateway-routes.ts`, `catalog-file.ts`, `management-server.ts`, `contracts/app.ts`, `supervisor.ts` `createGatewayProcessEnv`, `build/test.mjs`, `package.json`.
- `.planning/research/IMPORTED-DESIGN.md`, `.planning/research/FORK-SEAMS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`.

### Secondary (MEDIUM confidence)

- [OpenRouter list models](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) — `context_length`, `architecture.output_modalities`, `canonical_slug`. The example JSON omits `benchmarks`. The overview table names `benchmarks`. Context7 library `/websites/openrouter_ai`.
- [OpenRouter ModelBenchmarks](https://openrouter.ai/docs/client-sdks/python/components/modelbenchmarks) — `artificial_analysis.coding_index`, `agentic_index`, `intelligence_index`. Matches the live payload.
- [OpenRouter model variants](https://openrouter.ai/docs/guides/routing/model-variants/overview) — `:batch` is a catalog id suffix.
- [Parent issue #1911](https://github.com/musistudio/claude-code-router/issues/1911) — missing window, client assumes 200000, requested field names `context_window` and `max_context_window`.
- [Parent PR #1593](https://github.com/musistudio/claude-code-router/pull/1593) — `body.model` is `anthropic/claude-ccr-h` + hex.

### Tertiary (LOW confidence)

- [OpenRouter list benchmarks](https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks) — consulted to reject it. `model_permaslug` can differ from the routable id. Not used.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; Node 22.23.2 and the in-repo helpers were read.
- Architecture: HIGH — seams, parser, score, and snapshot match the locked design and the code that exists. The one-step tie-break is a stated discretion choice (A1).
- Pitfalls: HIGH — each one is a branch in code that was read, or a live payload shape.

**Research date:** 2026-11-14
**Valid until:** 2026-12-14 for the locked formula and the in-repo seams. Re-check the OpenRouter field names if implementation starts after 2026-11-21.

## What the planner must follow

1. New code only in `packages/core/src/class-switch/{catalog,plan,seam}.ts`. Tests only in `packages/core/test/unit/class-switch/`.
2. Parent edits: the end of `createRouteExecutionPlan`, `catalog.start`/`stop` in `startConfiguredServices`/`stopConfiguredServices`, and the end of `createGatewayModelsResponse`. Nowhere else.
3. `CCR_CLASS_SWITCH=0` returns the parent plan, does not fetch, and does not add context-window fields.
4. Score formula, cuts, one-index cap, tier tokens, `:batch`, and the review-queue distance rule in Pattern 4. Use the inline fixtures, not a live HTTP call, in tests.
5. Empty shelf keeps the parent attempt list. Do not implement bench, step-down, or a review UI.

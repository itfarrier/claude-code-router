---
phase: 01-shelves
reviewed: 2026-11-14T17:39:47Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - packages/core/src/class-switch/catalog.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/routing/execution-plan.ts
  - packages/core/src/gateway/features/model-discovery.ts
  - packages/core/src/web/management-server.ts
  - packages/core/test/unit/class-switch/plan.test.mjs
  - packages/core/test/unit/class-switch/classify.test.mjs
  - packages/core/test/unit/class-switch/context-window.test.mjs
findings:
  critical: 3
  warning: 6
  info: 1
  total: 10
  necessity: 1
status: issues_found
---

# Phase 01-shelves: Code Review Report

**Reviewed:** 2026-11-14T17:39:47Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The shelf classifier, `[1m]` filter, and models-response window overlay match the locked cuts when the caller passes a complete fixture. The live refresh does not. A failed OpenRouter score GET rewrites every successfully probed provider without the previous scores, so a model that was on a shelf only because of its score moves to `excluded`. The same refresh never passes OpenRouter output modality into `classifyModel`, so image, audio, and video outputs stay eligible. The desktop process never starts the walk, so those shelves are not seeded or refreshed there.

Necessity review was applied. One dead guard is provable from `classForScore`.

## Critical Issues

### CR-01: Failed score GET clears previous scores and can empty a shelf

**File:** `packages/core/src/class-switch/catalog.ts:704-738`
**Issue:** `fetchOpenRouterScoreRows` returns `undefined` on HTTP failure, timeout, or a second 401 (`catalog.ts:634-639`). `refreshClassShelves` still treats that as a normal refresh: every provider whose probe returns a `models` array is classified with no indexes (`catalog.ts:658` and `catalog.ts:667-671`) and the result is written over the snapshot (`catalog.ts:738`). A model with no tier token moves from its shelf to `excluded` / `no-index`. A model that keeps its tier token loses `score`, so attempt order changes. Probe failure still copies the old rows (`catalog.ts:727` and `catalog.ts:733`); score failure does not. The locked rule is the opposite: keep the previous scores, and classify only a new id with no indexes. `classify.test.mjs` never fails the score GET, so this path stays green.
**Fix:** When the score GET fails, keep each id that is still in the probe list on its previous shelf, review, or excluded row, including `score`. Refresh only `contextWindow`. Classify ids that were not in the previous snapshot with no indexes.

```ts
const scoreRows = await fetchOpenRouterScoreRows(config, options);
const scoresFailed = scoreRows === undefined;
// for each probed id:
const prior = findPreviousRow(previous, providerName, model);
if (scoresFailed && prior) {
  placePreviousRow(snapshot, prior, nextContextWindow);
  continue;
}
classifyProviderModels(...);
```

### CR-02: Catalog refresh never applies the non-text output rules

**File:** `packages/core/src/class-switch/catalog.ts:667-671`
**Issue:** `isNonTextModel` excludes a model when `outputModalities` has no `text`, or when `architectureModality` output (the side after `->`) lacks `text` or includes `image`, `audio`, or `video` (`catalog.ts:183-212`). The only production caller, `classifyProviderModels`, passes the model id and `benchmarks.artificial_analysis` only. `OpenRouterModelRow` does not even name `architecture` (`catalog.ts:70-76`). Id tokens catch `embed`, `whisper`, `tts`, `ocr`, `rerank`, and `moderation`. They do not catch `gpt-image-1` or an OpenRouter row whose modality is `text->image+text`. A scored image, audio, or video model is placed on a class shelf and `attemptsForClass` can send a `claude-opus` / `claude-sonnet` request to it. Seed has no OpenRouter payload; the delay-0 refresh is the pass that must apply this rule.
**Fix:** Read `architecture.modality` and `architecture.output_modalities` from the matched row and pass them into `classifyModel`. Do this on the success path only, when `scoreRows` is defined.

```ts
const architecture = openRouterRow?.architecture;
const classified = classifyModel({
  artificialAnalysis: openRouterRow?.benchmarks?.artificial_analysis,
  architectureModality: architecture?.modality,
  model,
  outputModalities: architecture?.output_modalities,
  provider: providerName
});
```

### CR-03: Desktop startup never seeds or refreshes shelves

**File:** `packages/electron/src/main/main-app.ts:250`
**Issue:** `start` / `stop` are wired only in `packages/core/src/web/management-server.ts:515` and `:522`. The desktop process starts the gateway in its own `startConfiguredServices` and only calls `syncProviderModelAutoRefresh` (`main-app.ts:250`). Quit stops auto-refresh and does not call `stopClassSwitch` (`main-app.ts:183`). Saving config from the desktop IPC handler refreshes auto-fetch only (`packages/electron/src/main/ipc.ts:359`). No other production caller starts the catalog. In that process `readShelfSnapshot()` stays empty unless some earlier CLI run left a file, `attemptsForClass` returns `undefined`, and class requests keep the parent plan. The 10-minute walk never runs.
**Fix:** Call `startClassSwitch(config)` after `syncProviderModelAutoRefresh(config)` in the desktop startup function. Call `stopClassSwitch()` before `stopProviderModelAutoRefreshService()` on quit. On desktop save, pass the saved config into the walk the same way auto-refresh is re-synced (see WR-01).

## Warnings

### WR-01: The catalog walk keeps the startup config object

**File:** `packages/core/src/class-switch/catalog.ts:763-771`
**Issue:** `scheduleCatalogWalk` closes over the `AppConfig` from `startClassSwitchCatalog`. `loadAppConfig` builds a new object on every read (`packages/core/src/config/config.ts:262`). `saveConfig` updates the gateway and calls `syncProviderModelAutoRefresh(savedConfig)` (`packages/core/src/web/management-server.ts:459`) and does not replace the object the walk holds. Later ticks still probe the old provider set, the old API key, and the old `modelMetadata`. A provider added in the web UI never joins a shelf. A rotated key keeps failing and the old rows stay. A context-window edit does not reach the `[1m]` filter until process restart. Auto-refresh avoids this by calling `loadAppConfig` inside each tick (`model-auto-refresh.ts:214`).
**Fix:** Reload config on each tick through an injected loader so unit tests can keep the fixture object. `seam.start` should pass `loadAppConfig` as that loader. Call the same start/update from `saveConfig` after the auto-refresh sync.

```ts
const latest = options.loadConfig ? await options.loadConfig() : config;
await refreshClassShelves(latest, options);
```

### WR-02: Three tier tokens can shelf or review depending on token order

**File:** `packages/core/src/class-switch/catalog.ts:246-257`
**Issue:** With no score, two tier classes compare the higher class to the other class. Three or more classes compare the higher class only to the first different token (`tierClasses.find`), not to the lowest class. `fable-opus-haiku` has span 3 (Fable to Haiku) but the first other token is `opus`, distance 1, so the model is shelved as Fable. `haiku-fable-opus` reviews, because `haiku` is seen first. The locked rule is one distance for the whole set: more than one step goes to `review`. The scored path does not have this bug; it uses the tier farthest from the score (`catalog.ts:285-287`).
**Fix:** Compare the highest class in the set with the lowest class in the set.

```ts
const higher = tierClasses.reduce((left, right) => higherShelfClass(left, right));
const lower = tierClasses.reduce((left, right) =>
  SHELF_CLASS_ORDER.indexOf(left) > SHELF_CLASS_ORDER.indexOf(right) ? left : right
);
if (classDistance(higher, lower) > 1) {
  return { kind: "review", reason: "score-tier-disagree", scoreClass: higher, tierClass: lower };
}
```

### WR-03: Overlay updates the window number and leaves the capability flags

**File:** `packages/core/src/class-switch/seam.ts:94-112`
**Issue:** `createClaudeAppGatewayModelsResponse` computes `supports_1m_context` and `context_window.supported` from the pre-overlay max (`model-discovery.ts:737-757`). `applyWindowFields` then overwrites `max_input_tokens`, `context_window`, and `max_context_window` when the snapshot is the only source. It does not update `supported` or `supports_1m_context`. A route with no metadata and no catalog max is built as `max_input_tokens: 0` and `supported: false`. A snapshot window of `1048576` replaces the number and leaves `supported: false` and `supports_1m_context: false`. The opposite also sticks: a route flagged as 1M keeps `supports_1m_context: true` after the snapshot writes a smaller window. `context-window.test.mjs` only covers a metadata window of `272000`, where the builder and the overlay agree.
**Fix:** After writing the number, set `supported` from `window > 0` and `supports_1m_context` from `window >= 1_000_000` on both `capabilities.context_window` and `capabilities.context_management` when those objects exist.

### WR-04: A permitted class name can be sent to a model the profile did not allow

**File:** `packages/core/src/class-switch/plan.ts:124-134`
**Issue:** The profile check runs on the requested model before the execution plan (`packages/core/src/gateway/request/pipeline.ts:431-433`). `isModelAllowedForProfile` treats `claude-opus-4-6` as allowed when that string, or the stripped seed `opus-4-6`, resolves to one allowlisted provider model (`model-allowlist.ts:98-120`). `attemptsForClass` then emits every resolved row on that shelf. `createRouteExecutionPlan` has no profile argument (`execution-plan.ts:9-46`). A key limited to `Alpha/opus-4-6` can be sent to `Beta/gpt-5.6-sol` when that row sorts first on the opus shelf. `resolvePlannedProviderCredentialRoutingTarget` writes `attempt.target.model` into the upstream body, so the substitution is what the provider receives.
**Fix:** Pass the authenticated profile into `createRouteExecutionPlan` and drop a shelf row unless `isModelAllowedForProfile(config, profile, provider + "/" + model)` is true. If none remain, return `undefined` so the parent plan stays.

### WR-05: A null excluded or review entry crashes model discovery

**File:** `packages/core/src/class-switch/catalog.ts:339-359`
**Issue:** `isShelfSnapshot` checks that `excluded` and `review` are arrays, then validates only `shelves.*` entries. `excluded: [null]` with well-formed shelves is accepted. `applyContextWindows` spreads those arrays and reads `row.provider` (`seam.ts:56-64`). `null` throws, and `createGatewayModelsResponse` does not catch it (`model-discovery.ts:114`). A hand-edited or partially valid cache file turns `GET /v1/models` into a 500. Shelf rows used for routing are checked, so this is the models response, not the attempt plan.
**Fix:** Reject the snapshot unless every `excluded` and `review` entry is an object with string `provider` and `model`. `readShelfSnapshot` then returns `undefined` and the models response keeps the builder fields.

### WR-06: Impossible-state guard — score class cannot be missing

**File:** `packages/core/src/class-switch/catalog.ts:276-279`
**Category:** necessity
**Issue:** `classForScore` always returns `fable`, `opus`, `sonnet`, or `haiku` (`catalog.ts:221-236`). The `| undefined` return type and the `if (!scoreClass)` branch defend against a state the function cannot produce. Every finite score takes one of the four branches, and the one-index cap returns `"sonnet"`.
**Fix:** Return `ShelfClass` from `classForScore` and delete the branch. Keep `shelfFromTierOnly` for the `score === undefined` path above it.

## Info

### IN-01: Snapshot window lookup is case-sensitive

**File:** `packages/core/src/class-switch/seam.ts:64`
**Issue:** The refresh stores the probe id as returned (`catalog.ts:653`). Metadata lookup folds case (`seam.ts:46-48`). Snapshot lookup requires `row.model === model` and `row.provider === providerName`. A probe id `gpt-4o` does not fill the window for registry model `GPT-4o`, so the third source is skipped and the response keeps the builder value.
**Fix:** Compare provider and model with the same trim-and-lowercase match used for metadata keys.

---

_Reviewed: 2026-11-14T17:39:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

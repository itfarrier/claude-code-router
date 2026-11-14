---
phase: 01-shelves
verified: 2026-11-14T18:48:23Z
status: human_needed
score: 33/33 must-haves verified
covered_files:
  - .planning/phases/01-shelves/01-01-PLAN.md
  - .planning/phases/01-shelves/01-01-SUMMARY.md
  - .planning/phases/01-shelves/01-02-PLAN.md
  - .planning/phases/01-shelves/01-02-SUMMARY.md
  - .planning/phases/01-shelves/01-03-PLAN.md
  - .planning/phases/01-shelves/01-03-SUMMARY.md
  - packages/core/src/class-switch/catalog.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/gateway/features/model-discovery.ts
  - packages/core/src/routing/execution-plan.ts
  - packages/core/src/web/management-server.ts
  - packages/core/test/unit/class-switch/classify.test.mjs
  - packages/core/test/unit/class-switch/context-window.test.mjs
  - packages/core/test/unit/class-switch/plan.test.mjs
covered_digest: "v4:sha256:6979a673f8efa7579bbf79327ead6d6e81d6af19612a60d7cabd882fc38f83ab"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 0
  total: 0
  not_honored: []
human_verification:
  - test: "Confirm a shelf open and a snapshot write do not read, copy, or log the chat message body, tool results, or images."
    expected: "The shelf input stays the model name, the registry, and the snapshot."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: applyShelf and the catalog walk have no message, tool-result, or image input."
  - test: "Confirm this phase does not change the model name in a response body and does not add x-ccr-requested-model or x-ccr-served-model."
    expected: "Window fields may change on /v1/models. The chat response model name and those two headers stay absent."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: class-switch code sets attempt targets and context-window fields only. Those headers are phase 3."
  - test: "Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged."
    expected: "The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: fetchOpenRouterScoreRows matches that rule, and the refresh test asserts the snapshot text does not contain the fixture key."
---

# Phase 1: Shelves Verification Report

**Phase Goal:** Models land on the right class shelf, and a catalog refresh keeps those shelves current.
**Verified:** 2026-11-14T18:48:23Z
**Status:** human_needed
**Re-verification:** No — initial verification

**unverified-prohibition — human review recommended.** Three judgment-tier prohibitions have no wired fail-first check. A non-authoritative read of the code finds that each prohibition holds. That read is not a pass. Automated must-haves are 33/33.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User sends a Claude class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, or `best`) and CCR opens that shelf. `best` opens Opus. A name Claude sends for `opusplan` opens Opus or Sonnet as sent. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens. `/v1/models` reports each model's real context window, so Claude does not treat every model as 200k. | ✓ VERIFIED | `parseClassRequest` opens those prefixes and exact `best`. `claude-opusplan` does not match because the next character is alphanumeric; Claude's own opus or sonnet name opens that class (`01-RESEARCH.md`). `[1m]` keeps `contextWindow >= 1000000`. `createGatewayModelsResponse` returns `applyContextWindows`. Tests `locked class families`, `opusplan best-model and bare opus`, `opus and sonnet one-million suffix`, and `gateway models expose a 272000 context window` passed. |
| 2 | User adds a provider model and CCR places it from OpenRouter `benchmarks.artificial_analysis` (weights 0.50 / 0.30 / 0.20; cuts 62 / 50 / 28). A missing index divides the remaining weights by their sum. One index cannot place a model above Sonnet. Tier words are `fable`/`astra`, `opus`/`sol`, `sonnet`/`terra`, `haiku`/`luna`. `flash`, `mini`, `nano`, and `lite` do not set a tier. A hex id still gets a class from the score or from those words. | ✓ VERIFIED | `scoreArtificialAnalysis`, `classForScore`, and `tierClassForToken` in `catalog.ts`. One present index forces Fable or Opus down to Sonnet. Tests for cuts, the one-index cap, tier tokens, and the hex id passed. |
| 3 | A model with no index and no tier word, a `:batch` model, or a non-text model stays off the shelves. A model whose score and tier word disagree by more than one step waits in the review queue and is not shelved. | ✓ VERIFIED | `classifyModel` returns `excluded` or `review`. `placeClassifyResult` writes review rows to `snapshot.review` only. `attemptsForClass` reads `snapshot.shelves`. Refresh test keeps `google/gemini-4-fable` in `review` and out of every shelf array. |
| 4 | User leaves CCR running and, every 10 minutes, each provider's model list refreshes with no text generation. A new name is classified. A missing name leaves the shelves. | ✓ VERIFIED | `startConfiguredServices` calls `startClassSwitch` on web startup (`management-server.ts`). Interval is `10 * 60 * 1000`. Probe `mode` is `"models"` (model list, not the connectivity ping). Tests for schedule, drop-missing, and classify-new passed. |
| 5 | A request model `claude-opus-4-6` replaces the parent attempt list with `BenchProvider/motif-technologies/motif-3` when that row is the scored Opus shelf, and the attempt target kind is `provider`. | ✓ VERIFIED | Test `claude-opus opens the scored opus shelf` passed. `createRouteExecutionPlan` returns `applyShelf(plan, input)`. |
| 6 | `claude-opusplan` and `best-model` do not open a shelf. `claude-opus-4-6` and the exact name `best` do. A context window of exactly 1000000 stays on an `opus[1m]` request, and a window of 999999 is dropped. | ✓ VERIFIED | `matchesClassPrefix` rejects an alphanumeric continuation. `rowPassesOneMillionFilter` uses `>= 1_000_000`. Tests `opusplan best-model and bare opus` and `opus and sonnet one-million suffix` passed. |
| 7 | An empty model name, a missing snapshot, a corrupt snapshot, and a shelf whose models do not resolve each keep the parent attempt list. One resolvable model replaces that list with one attempt. | ✓ VERIFIED | Empty trim returns from `parseClassRequest`. `readShelfSnapshot` returns undefined on throw or a failed shape check. Unresolved rows are skipped; an empty attempt list returns undefined so `applyShelf` keeps the parent plan. Test `empty corrupt and partial shelves` passed, including one resolvable row. |
| 8 | Class match uses the trimmed whole string and a case-insensitive compare. The route id `anthropic/claude-ccr-h` plus the hex UTF-8 of `claude-opus-4-6` opens Opus through `decodeClaudeAppGatewayRouteId`. The stored model id `motif-technologies/motif-3` is not split on a slash. | ✓ VERIFIED | `parseClassRequest` trims, decodes, then compares the lowercased whole string. Test `hex gateway route ids` passed. The opus-open test asserts `target.model` is `motif-technologies/motif-3`. |
| 9 | Two equal scores are ordered by provider then model using `localeCompare`, and a second read of the same snapshot returns that same order. A row with a score comes before a row with no score. | ✓ VERIFIED | `compareShelfRows` sorts scored rows first, then provider, then model. Test `equal scores sort` passed for the tie and the second read. The committed fixture's unscored row does not resolve. A verifier spot-check with a resolvable unscored row returned `Alpha/scored,Beta/scored,Beta/plain`. |
| 10 | Two shelf rows with the same score stay separate. Their attempt order is provider then model with `localeCompare`, and that order does not depend on which Artificial Analysis index was read first. | ✓ VERIFIED | Rows are not merged. `scoreArtificialAnalysis` walks the fixed `INDEX_WEIGHTS` key list, not the input object's key order. The equal-score test kept both rows. |
| 11 | `CCR_CLASS_SWITCH=0` returns the parent attempt list for `claude-opus-4-6` even when a valid Opus snapshot is on disk. | ✓ VERIFIED | `applyShelf` returns the parent plan when the env value is `"0"`. Test passed. |
| 12 | `best` opens Opus. `claude-fable-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5` open those classes. A bare `opus` name with no one-million suffix does not open a shelf. | ✓ VERIFIED | Short names are accepted only with the `[1m]` suffix. Tests `best opens the opus shelf`, `locked class families`, and the bare-`opus` case passed. |
| 13 | A provider model with `coding_index` 27.8, `agentic_index` 1, and `intelligence_index` 6.2 scores within 1e-9 of 15.44 and is placed on Haiku. | ✓ VERIFIED | Test `command-a-plus scores within 1e-9 of 15.44 and is haiku` passed. |
| 14 | A two-index score of exactly 62 is Fable, exactly 50 is Opus, and exactly 28 is Sonnet. 61.9 is Opus, 49.9 is Sonnet, and 27.9 is Haiku. One present index whose raw class is Fable or Opus becomes Sonnet, including a one-index score of exactly 62. A one-index score of 27 stays Haiku. | ✓ VERIFIED | `classForScore` cuts are `>= 62`, `>= 50`, `>= 28`, with the one-index cap. Boundary tests passed. |
| 15 | The token `sol` does not match inside `console`. When two OpenRouter rows share one final path segment, neither row is attached. When two rows match id or canonical_slug, neither row is attached. | ✓ VERIFIED | Tokens split on non-alphanumeric characters. `matchOpenRouterModel` requires exactly one match. Tests passed. |
| 16 | Null, absent, and non-finite indexes are missing. No present index and no tier word returns excluded reason `no-index`. One present index is divided by that index weight alone, so the score equals the index value. | ✓ VERIFIED | `finiteIndex` uses `Number.isFinite`. Test `one present index of 40` asserts `score === 40` and class Sonnet. Null, NaN, and Infinity tests passed. |
| 17 | The score is the IEEE-754 result of sum(weight times value) divided by sum(weight) for present finite indexes, with no integer rounding. `command-a-plus` is within 1e-9 of 15.44 and `motif-3` is within 1e-9 of 50.3375. | ✓ VERIFIED | The division is the raw double. Both numeric tests passed. `motif-3` indexes are coding 63.5, agentic 28.4, intelligence null, and the class is Opus. |
| 18 | After the one-index cap, class distance 0 or 1 shelves the score class. Distance 2 or 3 waits in review and is absent from every shelf. A colon segment equal to `batch` is excluded. A longer segment such as `batcher` is not a batch exclusion. | ✓ VERIFIED | `classDistance` uses Fable, Opus, Sonnet, Haiku indexes. `distance <= 1` shelves the score class. `isBatchModelId` compares a whole colon segment. Tests for distance and `batcher` passed. |
| 19 | An empty known output-modality list is non-text. Unknown modalities do not by themselves exclude a model. A model with no index and no tier word is excluded with reason `no-index`, and that single input produces no shelf row. | ✓ VERIFIED | An empty `outputModalities` array returns non-text. A list that includes `text` is not excluded for an unknown extra token. No-index returns `excluded`, and `placeClassifyResult` does not push that result onto a shelf. |
| 20 | The tokens `batch`, `embed`, `embedding`, `whisper`, `tts`, `ocr`, `rerank`, and `moderation` match as whole tokens after a simple case fold. They do not match inside a longer token. | ✓ VERIFIED | `NON_TEXT_ID_TOKENS` contains the eight non-batch tokens. Batch uses colon segments. Tests cover `BATCH`, `embedding`, `EMBEDDING`, and `textembeddingservice` (not a match). |
| 21 | Class distance is the integer gap on Fable, Opus, Sonnet, Haiku after the one-index cap. The score is not rounded before the cut. `intelligence_index` 53.9 alone plus a fable token waits in review. The same score plus an opus token shelves as Sonnet. | ✓ VERIFIED | 53.9 with one index is capped to Sonnet. Distance to Fable is 2, so the result is review. Distance to Opus is 1, so the result is shelf Sonnet. Both hydride tests passed. |
| 22 | `gpt-5.6-sol` with no indexes is Opus. `flash`, `mini`, `nano`, and `lite` do not set a class. A hex model id with a score is shelved, and the same hex id with no score and no tier token is `no-index`. | ✓ VERIFIED | `IGNORED_TIER_TOKENS` is that set of four. `gpt-5.6-sol`, `ling-3.2-flash:free`, and both hex cases passed. `terra-lite` stays Sonnet from `terra`, and `luna-nano` stays Haiku from `luna`. |
| 23 | A `:batch` id is excluded with reason `batch` even when the base score would place it. `:free`, `:nitro`, `:floor`, `:exacto`, and `:online` are not batch exclusions. Image, audio, or video output is non-text. Text-only output with image input stays eligible. | ✓ VERIFIED | Batch is checked before the score. Only a segment equal to `batch` is excluded. `text+image->text` with text output is `no-index`, not `non-text`. Image output tests passed. |
| 24 | A provider `modelMetadata` `contextWindow` of 272000 is returned as top-level `context_window` 272000 and `max_context_window` 272000. The value is not 200000. | ✓ VERIFIED | Test `gateway models expose a 272000 context window` passed through `createGatewayModelsResponse`. |
| 25 | An unknown window leaves the parent model object unchanged and does not add a context window field. `CCR_CLASS_SWITCH=0` does not add `context_window` or `max_context_window`. | ✓ VERIFIED | `applyContextWindows` returns the response unchanged when the switch is `"0"` or when no window resolves. Both tests passed. |
| 26 | The Anthropic-shaped models response also sets `max_input_tokens` and the existing `capabilities.context_window` and `capabilities.context_management` `max_input_tokens` when those objects already exist. The OpenAI-shaped response gains only the two top-level numbers. | ✓ VERIFIED | `applyWindowFields` writes nested fields only when those objects already exist. Claude and OpenAI-shaped tests passed. |
| 27 | The first walk is scheduled at delay 0. The next walk is scheduled only after the current walk settles, at the same 600000 millisecond interval as `providerModelAutoRefreshIntervalMs`. One model id in one successful fetch becomes one shelf row. | ✓ VERIFIED | `scheduleCatalogWalk` reschedules after `await runSerializedRefresh`. Test `class switch catalog schedules zero then the provider refresh interval` passed with `[0, 600000]`. A successful one-id probe is classified once. |
| 28 | An enabled provider with an empty base URL is not probed and adds no shelf row. A successful fetch that returns an empty model list removes that provider's previous shelf rows. A thrown probe keeps that provider's previous rows. | ✓ VERIFIED | Empty `providerBaseUrl` continues before `probeProvider`. An array result, including `[]`, replaces that provider's rows. `catch` calls `copyProviderRows`. Spot-check: one probe, `EMPTY_URL_PRESENT false`, empty fetch left no rows. Unit test for a thrown probe passed. |
| 29 | Shelf membership compares the probe id as an exact string. An id that contains a slash stays one id. The snapshot file is UTF-8 JSON and does not contain an API key. | ✓ VERIFIED | `classifyProviderModels` trims and dedupes the raw id. `google/gemini-4-fable` stays one review row. `writeShelfSnapshot` writes UTF-8 JSON. The refresh test asserts the fixture key is absent. |
| 30 | After a successful refresh, attempt order stays scored rows first by score descending, then rows with no score, with ties broken by provider then model using `localeCompare`. Provider walk order does not replace that sort. | ✓ VERIFIED | Refresh appends rows. `attemptsForClass` sorts with `compareShelfRows`. Spot-check order was `Alpha/scored,Beta/scored,Beta/plain` although the unscored row was stored first. |
| 31 | `CCR_CLASS_SWITCH=0` does not schedule a walk and does not fetch. A new probe id is classified. An id missing from a successful fetch leaves the shelves. A failed score GET keeps the previous scores. | ✓ VERIFIED | `start` and `startClassSwitchCatalog` return before schedule when the switch is `"0"`. Tests for the kill switch, the missing id `stale-model`, and `failed score GET keeps prior shelf rows and scores` passed. |
| 32 | A seeded BenchProvider model `gpt-5.6-sol` with `modelMetadata` `contextWindow` 1000000 stays on the `opus[1m]` attempt list when the probe has not succeeded, and a thrown probe keeps that row with `contextWindow` 1000000. | ✓ VERIFIED | `seedShelvesFromConfig` classifies config models and stores the window. `copyProviderRows` keeps it. Test `catalog refresh drops a missing model and keeps a failed provider` passed both assertions. |
| 33 | After `refreshClassShelves`, a model whose only index is `intelligence_index` 53.9 and whose id token is `fable` is in `snapshot.review` and is absent from every shelves array. | ✓ VERIFIED | Same refresh test asserts `reason` `score-tier-disagree` and absence from fable, opus, sonnet, and haiku. |

**Score:** 33/33 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/core/src/class-switch/catalog.ts` | Score, classifier, snapshot, window chain, 10-minute walk | ✓ VERIFIED | Exports present. About 930 lines. Used by `plan.ts` and `seam.ts`. |
| `packages/core/src/class-switch/plan.ts` | Class-name parse and ordered shelf attempts | ✓ VERIFIED | `parseClassRequest` and `attemptsForClass` are called by `applyShelf`. |
| `packages/core/src/class-switch/seam.ts` | `applyShelf`, `start`, `stop`, `applyContextWindows` | ✓ VERIFIED | Parent files import this module only. |
| `packages/core/src/routing/execution-plan.ts` | Parent plan, then `applyShelf` | ✓ VERIFIED | `createRouteExecutionPlan` returns `applyShelf(plan, input)`. |
| `packages/core/src/gateway/features/model-discovery.ts` | `createGatewayModelsResponse` returns `applyContextWindows` | ✓ VERIFIED | Return is `applyContextWindows(response, config)`. Router `GET /v1/models` calls `createGatewayModelsResponse`. |
| `packages/core/src/web/management-server.ts` | `start` and `stop` beside the existing auto-refresh calls | ✓ VERIFIED | Startup and config save call `startClassSwitch`. `stopConfiguredServices` calls `stopClassSwitch`. |
| `packages/core/test/unit/class-switch/plan.test.mjs` | SHELF-01 class open, one-million filter, hex route, kill switch, empty shelf | ✓ VERIFIED | 9 tests passed in this file. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | SHELF-02, SHELF-03, and BACK-01 refresh | ✓ VERIFIED | 32 tests passed in this file, including the WR-08 follow-up. |
| `packages/core/test/unit/class-switch/context-window.test.mjs` | Real context window on `/v1/models` | ✓ VERIFIED | 10 tests passed in this file. |

`gsd-tools query verify.artifacts` reported valid for `01-01-PLAN.md`, `01-02-PLAN.md`, and `01-03-PLAN.md`.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `packages/core/src/routing/execution-plan.ts` | `packages/core/src/class-switch/seam.ts` | `applyShelf` | WIRED | Pattern found. Return is `applyShelf(plan, input)`. |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/plan.ts` | `attemptsForClass` | WIRED | `applyShelf` calls `attemptsForClass`. |
| `packages/core/src/class-switch/plan.ts` | `packages/core/src/class-switch/catalog.ts` | `readShelfSnapshot` | WIRED | `attemptsForClass` reads the snapshot. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | `packages/core/src/class-switch/catalog.ts` | `classifyModel` | WIRED | Pattern found. |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | shelf rows sorted by `attemptsForClass` | PARTIAL | Tool pattern `kind shelf` is absent. The path is present: `classifyModel` returns `kind: "shelf"`, `placeClassifyResult` writes `shelves[class]`, and `attemptsForClass` sorts that array. This pattern miss is not a broken shelf. |
| `packages/core/src/gateway/features/model-discovery.ts` | `packages/core/src/class-switch/seam.ts` | `applyContextWindows` | WIRED | Pattern found. |
| `packages/core/src/web/management-server.ts` | `packages/core/src/class-switch/seam.ts` | `startClassSwitch` | WIRED | Import alias `start as startClassSwitch`. Called from startup and config save. |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/catalog.ts` | `startClassSwitchCatalog` | WIRED | `start` calls `startClassSwitchCatalog`. `applyContextWindows` calls `contextWindowForProviderModel`. |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | stored `contextWindow` read by the `[1m]` filter | WIRED | Seed and a successful refresh store `contextWindowForProviderModel`. A thrown probe copies that number. `rowPassesOneMillionFilter` reads it. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `catalog.ts` shelf rows | `shelves`, `review`, `excluded` | Provider probe model ids, OpenRouter `benchmarks.artificial_analysis`, tier tokens | Yes. Tests inject the probe and the score payload. The default score GET is `https://openrouter.ai/api/v1/models`. | ✓ FLOWING |
| `plan.ts` attempts | `attempts` | `readShelfSnapshot` plus `modelRegistry.resolve` | Yes. A snapshot row becomes `provider/model` with `target.kind === "provider"`. | ✓ FLOWING |
| `seam.ts` windows | `context_window`, `max_context_window` | Provider `modelMetadata`, catalog max, then the snapshot window | Yes. 272000 comes from metadata. An unknown window adds no field. | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Class open, score, exclusions, refresh, windows, WR-08 follow-up | `node --test` on the three bundled class-switch files | 51 pass, 0 fail, 0 skipped | ✓ PASS |
| Scored rows before a resolvable unscored row | Verifier script calling `createRouteExecutionPlan` | `Alpha/scored,Beta/scored,Beta/plain` | ✓ PASS |
| Empty base URL is not probed and adds no row; empty model list clears that provider | Verifier script calling `refreshClassShelves` | `PROBES 1`, `EMPTY_URL_PRESENT false`, `ROWS (none)` | ✓ PASS |

Commit `6953fec7` is `fix(01): WR-08 run follow-up after failed in-flight refresh`. `runSerializedRefresh` catches an in-flight rejection and still starts the queued pass. The test `config save during failed shelf refresh still runs follow-up pass` passed. The review sentence that still names WR-08 as open is stale.

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `probe-*.sh` is declared for this phase | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SHELF-01 | 01-01, 01-03 | Class name opens the shelf, `[1m]` filters the window, `/v1/models` reports the real window | ✓ SATISFIED | Truths 1, 5–8, 11–12, 24–26, 32 |
| SHELF-02 | 01-01, 01-02 | Score weights, cuts, one-index cap, tier words, hex id | ✓ SATISFIED | Truths 2, 10, 13–17, 22 |
| SHELF-03 | 01-02 | No-index, `:batch`, and non-text stay off the shelves. Distance greater than one waits in `review` | ✓ SATISFIED | Truths 3, 18–23, 33. `REQUIREMENTS.md` traceability still says Pending. The requirement checkbox is `[x]`, and the code matches the requirement text. |
| BACK-01 | 01-03 | Every 10 minutes, refresh model lists with no text generation. New names are classified. Missing names leave. | ✓ SATISFIED | Truths 4, 27–31 |

Plan frontmatter IDs are SHELF-01, SHELF-02, SHELF-03, and BACK-01. Those are the only requirement IDs mapped to Phase 1. No Phase 1 ID is missing from the plans. Other requirement IDs belong to Phase 2 or Phase 3.

### Decision Coverage

No trackable decisions in `01-CONTEXT.md`. The decisions block says implementation choices were left open because discuss was skipped. Honored 0 / total 0. This gate does not change status.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `plan.test.mjs` | SHELF-01, SHELF-02 order | 9 | 0 | No | Value | PASS |
| `classify.test.mjs` | SHELF-02, SHELF-03, BACK-01 | 32 | 0 | No | Value / behavioral | PASS |
| `context-window.test.mjs` | SHELF-01 window | 10 | 0 | No | Value | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0. Expected scores are written constants (15.44, 50.3375, 272000), not output captured from the same run.
**Insufficient assertions:** 0 blockers. The committed equal-score fixture does not resolve its unscored row. The `:nitro`, `:floor`, `:exacto`, and `:online` cases share the `batch` segment check; the file asserts `:free` directly. The verifier spot-check covered the unscored-row order.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/core/src/class-switch/catalog.ts` | 834 | `shortcut:` providers with `autoFetchModels` are listed twice per 10 minutes | ℹ️ Info | Extra model-list traffic. It does not drop or mis-classify a shelf row. |
| — | — | `TBD`, `FIXME`, `XXX` | — | None in the phase files. |

### Human Verification Required

### 1. Shelf input does not include the chat body

**Test:** Confirm a shelf open and a snapshot write do not read, copy, or log the chat message body, tool results, or images.
**Expected:** The shelf input stays the model name, the registry, and the snapshot.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: the functions do not take those inputs.

### 2. Response model name and phase-3 headers stay unchanged

**Test:** Confirm this phase does not change the model name in a response body and does not add `x-ccr-requested-model` or `x-ccr-served-model`.
**Expected:** `/v1/models` may gain context-window fields. The chat response model name and those headers stay absent.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: this phase does not write those headers.

### 3. OpenRouter key use

**Test:** Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only for host `openrouter.ai`, and that the key is not stored or logged.
**Expected:** First GET has no authorization header. A 401 may retry with that host's key. The snapshot has no key.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: `fetchOpenRouterScoreRows` follows that rule, and a unit test asserts the fixture key is absent from the snapshot file.

### Accepted deferrals

These stay in the code on purpose. They are not gaps for this phase.

- WR-04: a class shelf can include a model the profile did not allow. The profile check still runs on the requested name before the plan is built. Phase 2 owns the live attempt filter. This phase does not rewrite the parent request loop.
- IN-01: snapshot window lookup compares provider and model with exact strings (`seam.ts` `snapshotContextWindow`). Metadata lookup already folds case. Left open on purpose.

Bench, step-down, and a review-queue screen are later work. `snapshot.review` is the queue. There is no approve or reject UI in this phase.

### Gaps Summary

No must-have failed. The shelf opens from the class name, the score and tier rules place or exclude the model, and the 10-minute walk classifies new ids and drops ids missing from a successful fetch. A thrown probe and a failed score GET keep the previous rows. `/v1/models` reports a configured window of 272000 rather than 200000.

Status is `human_needed` because three judgment-tier prohibitions have no fail-first enforcement. The code read says they hold. That read does not clear them.

---

_Verified: 2026-11-14T18:48:23Z_
_Verifier: Claude (gsd-verifier)_

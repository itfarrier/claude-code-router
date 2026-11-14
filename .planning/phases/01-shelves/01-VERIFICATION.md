---
phase: 01-shelves
verified: 2026-11-14T23:13:06Z
status: passed
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
covered_digest: "v4:sha256:60b87138bd48a4ae2f064cc9949676630890b93741faa96bce992a7b55abecdb"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 0
  total: 0
  not_honored: []
re_verification:
  previous_status: human_needed
  previous_score: 33/33
  gaps_closed: []
  gaps_remaining: []
  regressions: []
coincidental_reliance_items:
  - truth: "Two equal scores are ordered by provider then model using localeCompare, and a second read of the same snapshot returns that same order. A row with a score comes before a row with no score."
    reason: incidental-ordering
    harden: "Phase 2 layered a sanctioned thin-share reorder on every 20th shelf-open call (finalizeRowOrder/applyThinShare, CHOICE-01). The unit test passes because its three reads sit at thinShareCounter positions 22-24 in its own file process. Have the test call setThinShareCounter(0) before its reads so the stability assertion no longer depends on how many shelf opens precede it in the file."
human_verification:
  - test: "Confirm the snapshot write and classification path (seedShelvesFromConfig, refreshClassShelves, writeShelfSnapshot) does not read, copy, or log the chat message body, tool results, or images."
    expected: "The catalog walk input is the config, the registry, the probe, and the previous snapshot. The snapshot JSON holds model ids, scores, tier classes, windows, and reasons only."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: those functions take config, probe, and snapshot only. Narrowed from the prior item: the shelf-open half is superseded by phase 2 (see Superseded section)."
  - test: "Confirm this phase does not change the model name in a response body and does not add x-ccr-requested-model or x-ccr-served-model."
    expected: "Window fields may change on /v1/models. The chat response model name and those two headers stay absent."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: class-switch code sets attempt targets and context-window fields only; grep finds neither header in any covered file. Those headers are phase 3 (FALL-02)."
  - test: "Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged."
    expected: "The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key."
    why_human: "unverified-prohibition — human review recommended. Judgment-tier prohibition with no fail-first check. Non-authoritative review: fetchOpenRouterScoreRows matches that rule (request() sends no header until a 401; openRouterApiKey filters to enabled providers whose base-URL host is exactly openrouter.ai), and the refresh test asserts the snapshot text does not contain the fixture key."
---

# Phase 1: Shelves Verification Report

**Phase Goal:** Models land on the right class shelf, and a catalog refresh keeps those shelves current.
**Verified:** 2026-11-14T23:13:06Z
**Status:** passed — human validation recorded 2026-11-14T23:33:33Z (autonomous run; 3 judgment-tier prohibition items validated by the user)
**Re-verification:** Yes — regeneration after covered source files changed (phase-2 commits touched `plan.ts`, `seam.ts`, `execution-plan.ts`, `catalog.ts`, and two test files after the prior report).

**unverified-prohibition — human review recommended.** Three judgment-tier prohibitions have no wired fail-first check. A non-authoritative read of the current code finds that each prohibition holds (one narrowed — see Superseded). That read is not a pass. Automated must-haves are 33/33.

## Regeneration Scope

Phase-2 work (bench, live triples, one-credential attempts) modified files this phase covers. Per the regeneration instruction, every truth was re-derived from the current code, not from the prior report's verdicts:

- `plan.ts` gained phase-2 layers (bench sort signals, thin share, request facts, tool-turn stickiness, credential fan-out) around the unchanged phase-1 core (`parseClassRequest`, `compareShelfRows`, `rowPassesOneMillionFilter`).
- `seam.ts` gained `startBench`/`stopBench` beside the phase-1 functions; `applyShelf` and `applyContextWindows` keep their `CCR_CLASS_SWITCH=0` short-circuits.
- `execution-plan.ts` still ends with `return applyShelf(plan, input)`.
- `catalog.ts` classifier changes are pure refactors (dead null-check removal, equivalent `lower` computation); the refresh gained explicit prior-row preservation on a failed score GET.
- `classify.test.mjs` and `context-window.test.mjs` diffs are purely additive — no phase-1 assertion was removed or weakened; `plan.test.mjs` is byte-identical to phase-1 completion (`git diff df9d8854 HEAD` shows no change).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User sends a Claude class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, or `best`) and CCR opens that shelf. `best` opens Opus. A name Claude sends for `opusplan` opens Opus or Sonnet as sent. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens. `/v1/models` reports each model's real context window, so Claude does not treat every model as 200k. | ✓ VERIFIED | `parseClassRequest` opens those prefixes and exact `best`; `claude-opusplan` does not match because the next character is alphanumeric. `[1m]` keeps `contextWindow >= 1000000` (`rowPassesOneMillionFilter`). `createGatewayModelsResponse` returns `applyContextWindows(response, config)` (model-discovery.ts line 114). Tests `locked class families open their shelves`, `opusplan best-model and bare opus keep the parent attempt list`, `opus and sonnet one-million suffix filters context window`, and `gateway models expose a 272000 context window` all passed in the current suite run. |
| 2 | User adds a provider model and CCR places it from OpenRouter `benchmarks.artificial_analysis` (weights 0.50 / 0.30 / 0.20; cuts 62 / 50 / 28). A missing index divides the remaining weights by their sum. One index cannot place a model above Sonnet. Tier words are `fable`/`astra`, `opus`/`sol`, `sonnet`/`terra`, `haiku`/`luna`. `flash`, `mini`, `nano`, and `lite` do not set a tier. A hex id still gets a class from the score or from those words. | ✓ VERIFIED | `scoreArtificialAnalysis`, `classForScore`, and `tierClassForToken` in `catalog.ts` are semantically unchanged (the phase-2 diff only removed a dead null check and generalized an equivalent expression). All classify tests passed. |
| 3 | A model with no index and no tier word, a `:batch` model, or a non-text model stays off the shelves. A model whose score and tier word disagree by more than one step waits in the review queue and is not shelved. | ✓ VERIFIED | `classifyModel` returns `excluded` or `review`. `placeClassifyResult` writes review rows to `snapshot.review` only (catalog.ts lines 625-645). `attemptsForClass` reads only `snapshot.shelves[class]` (plan.ts line 375). Refresh test keeps `google/gemini-4-fable` in `review` and out of every shelf array. |
| 4 | User leaves CCR running and, every 10 minutes, each provider's model list refreshes with no text generation. A new name is classified. A missing name leaves the shelves. | ✓ VERIFIED | `startConfiguredServices` calls `startClassSwitch` (management-server.ts lines 460, 516); `stopConfiguredServices` calls `stopClassSwitch` (line 523). Interval is `providerModelAutoRefreshIntervalMs = 10 * 60 * 1000`. Probe `mode` is `"models"`. Tests `class switch catalog schedules zero then the provider refresh interval`, `catalog refresh drops a missing model and keeps a failed provider` passed. |
| 5 | A request model `claude-opus-4-6` replaces the parent attempt list with `BenchProvider/motif-technologies/motif-3` when that row is the scored Opus shelf, and the attempt target kind is `provider`. | ✓ VERIFIED | Test `claude-opus opens the scored opus shelf` passed against the current `attemptsForClass` (the new phase-2 filter layers are inert with no bench data, no tools, no image, and zero estimated tokens in that fixture). `createRouteExecutionPlan` returns `applyShelf(plan, input)`. |
| 6 | `claude-opusplan` and `best-model` do not open a shelf. `claude-opus-4-6` and the exact name `best` do. A context window of exactly 1000000 stays on an `opus[1m]` request, and a window of 999999 is dropped. | ✓ VERIFIED | `matchesClassPrefix` rejects an alphanumeric continuation. `rowPassesOneMillionFilter` uses `>= 1_000_000`. Both tests passed. |
| 7 | An empty model name, a missing snapshot, a corrupt snapshot, and a shelf whose models do not resolve each keep the parent attempt list. One resolvable model replaces that list with one attempt. | ✓ VERIFIED | Empty trim returns from `parseClassRequest`. `readShelfSnapshot` returns undefined on throw or a failed shape check. Unresolved rows are skipped; an empty attempt list returns undefined so `applyShelf` keeps the parent plan. Test `empty corrupt and partial shelves keep or narrow parent attempts` passed. |
| 8 | Class match uses the trimmed whole string and a case-insensitive compare. The route id `anthropic/claude-ccr-h` plus the hex UTF-8 of `claude-opus-4-6` opens Opus through `decodeClaudeAppGatewayRouteId`. The stored model id `motif-technologies/motif-3` is not split on a slash. | ✓ VERIFIED | `parseClassRequest` trims, decodes, then compares the lowercased whole string; a decoded value containing `/` returns undefined (line 79-81). Test `hex gateway route ids open the decoded opus class` passed. The opus-open test asserts `target.model` is `motif-technologies/motif-3`. |
| 9 | Two equal scores are ordered by provider then model using `localeCompare`, and a second read of the same snapshot returns that same order. A row with a score comes before a row with no score. | ✓ VERIFIED (coincidental-reliance) | `compareShelfRows` sorts scored rows first, then (with no bench data) falls through to provider, then model. Test `equal scores sort by provider then model and no-score rows go last` passed for the tie and the second read. Caveat: phase 2 layered a sanctioned thin-share reorder on every 20th shelf-open call (`finalizeRowOrder`/`applyThinShare`, ROADMAP Phase 2 SC "Near-tied models still receive a thin share of requests"). The test passes because its three reads sit at `thinShareCounter` positions 22-24 in its own file process — see `coincidental_reliance_items`. |
| 10 | Two shelf rows with the same score stay separate. Their attempt order is provider then model with `localeCompare`, and that order does not depend on which Artificial Analysis index was read first. | ✓ VERIFIED | Rows are not merged. `scoreArtificialAnalysis` walks the fixed `INDEX_WEIGHTS` key list, not the input object's key order. The equal-score test kept both rows. |
| 11 | `CCR_CLASS_SWITCH=0` returns the parent attempt list for `claude-opus-4-6` even when a valid Opus snapshot is on disk. | ✓ VERIFIED | `applyShelf` (seam.ts lines 224-243) returns the parent plan when the env value is exactly `"0"`, before any snapshot read. Test `CCR_CLASS_SWITCH=0 keeps parent attempts with a valid shelf snapshot` passed. |
| 12 | `best` opens Opus. `claude-fable-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5` open those classes. A bare `opus` name with no one-million suffix does not open a shelf. | ✓ VERIFIED | Short names are accepted only with the `[1m]` suffix (`SHORT_CLASS_NAMES` behind the `requireOneMillion` branch). Tests `best opens the opus shelf`, `locked class families open their shelves`, and the bare-`opus` case passed. |
| 13 | A provider model with `coding_index` 27.8, `agentic_index` 1, and `intelligence_index` 6.2 scores within 1e-9 of 15.44 and is placed on Haiku. | ✓ VERIFIED | Test `command-a-plus scores within 1e-9 of 15.44 and is haiku` passed. |
| 14 | A two-index score of exactly 62 is Fable, exactly 50 is Opus, and exactly 28 is Sonnet. 61.9 is Opus, 49.9 is Sonnet, and 27.9 is Haiku. One present index whose raw class is Fable or Opus becomes Sonnet, including a one-index score of exactly 62. A one-index score of 27 stays Haiku. | ✓ VERIFIED | `classForScore` cuts are `>= 62`, `>= 50`, `>= 28`, with the one-index cap. Boundary tests passed. |
| 15 | The token `sol` does not match inside `console`. When two OpenRouter rows share one final path segment, neither row is attached. When two rows match id or canonical_slug, neither row is attached. | ✓ VERIFIED | Tokens split on non-alphanumeric characters. `matchOpenRouterModel` requires exactly one match. Tests passed. |
| 16 | Null, absent, and non-finite indexes are missing. No present index and no tier word returns excluded reason `no-index`. One present index is divided by that index weight alone, so the score equals the index value. | ✓ VERIFIED | `finiteIndex` uses `Number.isFinite`. The one-present-index test asserts `score === 40` and class Sonnet. Null, NaN, and Infinity tests passed. |
| 17 | The score is the IEEE-754 result of sum(weight times value) divided by sum(weight) for present finite indexes, with no integer rounding. `command-a-plus` is within 1e-9 of 15.44 and `motif-3` is within 1e-9 of 50.3375. | ✓ VERIFIED | The division is the raw double. Both numeric tests passed. `motif-3` indexes are coding 63.5, agentic 28.4, intelligence null, and the class is Opus. |
| 18 | After the one-index cap, class distance 0 or 1 shelves the score class. Distance 2 or 3 waits in review and is absent from every shelf. A colon segment equal to `batch` is excluded. A longer segment such as `batcher` is not a batch exclusion. | ✓ VERIFIED | `classDistance` uses the Fable, Opus, Sonnet, Haiku order. `distance <= 1` shelves the score class. `isBatchModelId` compares a whole colon segment. Tests passed. |
| 19 | An empty known output-modality list is non-text. Unknown modalities do not by themselves exclude a model. A model with no index and no tier word is excluded with reason `no-index`, and that single input produces no shelf row. | ✓ VERIFIED | An empty `outputModalities` array returns non-text (catalog.ts lines 195-203). A list that includes `text` is not excluded for an unknown extra token. No-index returns `excluded`, and `placeClassifyResult` does not push that result onto a shelf. |
| 20 | The tokens `batch`, `embed`, `embedding`, `whisper`, `tts`, `ocr`, `rerank`, and `moderation` match as whole tokens after a simple case fold. They do not match inside a longer token. | ✓ VERIFIED | `NON_TEXT_ID_TOKENS` contains the seven non-batch tokens; batch uses colon segments. Tests cover `BATCH`, `embedding`, `EMBEDDING`, and the non-match longer token. |
| 21 | Class distance is the integer gap on Fable, Opus, Sonnet, Haiku after the one-index cap. The score is not rounded before the cut. `intelligence_index` 53.9 alone plus a fable token waits in review. The same score plus an opus token shelves as Sonnet. | ✓ VERIFIED | 53.9 with one index is capped to Sonnet. Distance to Fable is 2, so the result is review. Distance to Opus is 1, so the result is shelf Sonnet. Both tests passed. |
| 22 | `gpt-5.6-sol` with no indexes is Opus. `flash`, `mini`, `nano`, and `lite` do not set a class. A hex model id with a score is shelved, and the same hex id with no score and no tier token is `no-index`. | ✓ VERIFIED | `IGNORED_TIER_TOKENS` is that set of four. `gpt-5.6-sol`, `ling-3.2-flash:free`, and both hex cases passed. |
| 23 | A `:batch` id is excluded with reason `batch` even when the base score would place it. `:free`, `:nitro`, `:floor`, `:exacto`, and `:online` are not batch exclusions. Image, audio, or video output is non-text. Text-only output with image input stays eligible. | ✓ VERIFIED | Batch is checked before the score and before non-text. Only a segment equal to `batch` is excluded. `text+image->text` with text output is `no-index`, not `non-text`. Image output tests passed. |
| 24 | A provider `modelMetadata` `contextWindow` of 272000 is returned as top-level `context_window` 272000 and `max_context_window` 272000. The value is not 200000. | ✓ VERIFIED | Test `gateway models expose a 272000 context window` passed through `createGatewayModelsResponse` on the current `applyContextWindows`. |
| 25 | An unknown window leaves the parent model object unchanged and does not add a context window field. `CCR_CLASS_SWITCH=0` does not add `context_window` or `max_context_window`. | ✓ VERIFIED | `applyContextWindows` returns the response unchanged when the switch is `"0"` (seam.ts line 137) and `continue`s past a row when no window resolves (line 176-178). `applyWindowFields` is only called for a truthy window. Both tests passed. |
| 26 | The Anthropic-shaped models response also sets `max_input_tokens` and the existing `capabilities.context_window` and `capabilities.context_management` `max_input_tokens` when those objects already exist. The OpenAI-shaped response gains only the two top-level numbers. | ✓ VERIFIED | `applyWindowFields` writes nested fields only when those objects already exist (seam.ts lines 109-131; phase 2 additionally sets `supported`/`supports_1m_context` flags on the same pre-existing objects — additive, still gated on a resolved window). Claude- and OpenAI-shaped tests passed. |
| 27 | The first walk is scheduled at delay 0. The next walk is scheduled only after the current walk settles, at the same 600000 millisecond interval as `providerModelAutoRefreshIntervalMs`. One model id in one successful fetch becomes one shelf row. | ✓ VERIFIED | `scheduleCatalogWalk` reschedules after `await runSerializedRefresh` (catalog.ts lines 871-894). Test `class switch catalog schedules zero then the provider refresh interval` passed with `[0, 600000]`. A successful one-id probe is classified once. |
| 28 | An enabled provider with an empty base URL is not probed and adds no shelf row. A successful fetch that returns an empty model list removes that provider's previous shelf rows. A thrown probe keeps that provider's previous rows. | ✓ VERIFIED | Empty `providerBaseUrl` continues before `probeProvider` (catalog.ts lines 803-806). An array result, including `[]`, replaces that provider's rows via `classifyProviderModels`. A throw calls `copyProviderRows`. Unit test passed. |
| 29 | Shelf membership compares the probe id as an exact string. An id that contains a slash stays one id. The snapshot file is UTF-8 JSON and does not contain an API key. | ✓ VERIFIED | `classifyProviderModels` trims and dedupes the raw id. `google/gemini-4-fable` stays one review row. `writeShelfSnapshot` writes UTF-8 JSON via a temp file and rename. The refresh test asserts the fixture key is absent. |
| 30 | After a successful refresh, attempt order stays scored rows first by score descending, then rows with no score, with ties broken by provider then model using `localeCompare`. Provider walk order does not replace that sort. | ✓ VERIFIED | Refresh appends rows in walk order; `attemptsForClass` sorts with `compareShelfRows` before building attempts. Same thin-share caveat as truth 9 (applies only to near-ties on every 20th call). |
| 31 | `CCR_CLASS_SWITCH=0` does not schedule a walk and does not fetch. A new probe id is classified. An id missing from a successful fetch leaves the shelves. A failed score GET keeps the previous scores. | ✓ VERIFIED | `start` (seam.ts) and `startClassSwitchCatalog` return before schedule when the switch is `"0"`. On a failed score GET, `scoresFailed` paths reuse the prior row (`findPreviousRow`/`placePreviousRow`) for existing ids and classify new ids with no indexes. Tests for the kill switch, the missing id, and `failed score GET keeps prior shelf rows and scores` passed. |
| 32 | A seeded BenchProvider model `gpt-5.6-sol` with `modelMetadata` `contextWindow` 1000000 stays on the `opus[1m]` attempt list when the probe has not succeeded, and a thrown probe keeps that row with `contextWindow` 1000000. | ✓ VERIFIED | `seedShelvesFromConfig` classifies config models and stores the window; `copyProviderRows` keeps it on a thrown probe. Test `catalog refresh drops a missing model and keeps a failed provider` passed both assertions. |
| 33 | After `refreshClassShelves`, a model whose only index is `intelligence_index` 53.9 and whose id token is `fable` is in `snapshot.review` and is absent from every shelves array. | ✓ VERIFIED | The same refresh test asserts reason `score-tier-disagree` and absence from fable, opus, sonnet, and haiku. |

**Score:** 33/33 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/core/src/class-switch/catalog.ts` | Score, classifier, snapshot, window chain, 10-minute walk | ✓ VERIFIED | All plan-01/02/03 exports present. Used by `plan.ts` and `seam.ts`. |
| `packages/core/src/class-switch/plan.ts` | Class-name parse and ordered shelf attempts | ✓ VERIFIED | `parseClassRequest` and `attemptsForClass` are called by `applyShelf`; phase-2 layers wrap but do not replace them. |
| `packages/core/src/class-switch/seam.ts` | `applyShelf`, `start`, `stop`, `applyContextWindows` | ✓ VERIFIED | Parent files import this module only; `start`/`stop` now also drive the phase-2 bench. |
| `packages/core/src/routing/execution-plan.ts` | Parent plan, then `applyShelf` | ✓ VERIFIED | `createRouteExecutionPlan` returns `applyShelf(plan, input)` (line 40). |
| `packages/core/src/gateway/features/model-discovery.ts` | `createGatewayModelsResponse` returns `applyContextWindows` | ✓ VERIFIED | Return is `applyContextWindows(response, config)` (line 114). |
| `packages/core/src/web/management-server.ts` | `start` and `stop` beside the existing auto-refresh calls | ✓ VERIFIED | Startup and config save call `startClassSwitch`; `stopConfiguredServices` calls `stopClassSwitch` first. |
| `packages/core/test/unit/class-switch/plan.test.mjs` | SHELF-01 class open, one-million filter, hex route, kill switch, empty shelf | ✓ VERIFIED | 9 tests, unchanged since phase-1 completion, all passed. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | SHELF-02, SHELF-03, and BACK-01 refresh | ✓ VERIFIED | 32 tests passed (file grew additively with phase-2 refresh cases). |
| `packages/core/test/unit/class-switch/context-window.test.mjs` | Real context window on `/v1/models` | ✓ VERIFIED | 10 tests passed (file grew additively with one phase-2 flag test). |

`gsd-tools query verify.artifacts` reported `all_passed: true` for `01-01-PLAN.md` (5/5), `01-02-PLAN.md` (2/2), and `01-03-PLAN.md` (6/6).

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `packages/core/src/routing/execution-plan.ts` | `packages/core/src/class-switch/seam.ts` | `applyShelf` | WIRED | Pattern found. Return is `applyShelf(plan, input)`. |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/plan.ts` | `attemptsForClass` | WIRED | `applyShelf` calls `attemptsForClass` with the request-facts scalars. |
| `packages/core/src/class-switch/plan.ts` | `packages/core/src/class-switch/catalog.ts` | `readShelfSnapshot` | WIRED | `attemptsForClass` reads the snapshot. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | `packages/core/src/class-switch/catalog.ts` | `classifyModel` | WIRED | Pattern found. |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | shelf rows sorted by `attemptsForClass` | PARTIAL (wired) | Tool pattern `kind shelf` is a literal miss; the code writes `kind: "shelf"` and `result.kind === "shelf"`. Path verified manually: `classifyModel` returns `kind: "shelf"` (catalog.ts lines 286, 294), `placeClassifyResult` writes `shelves[result.class]` (line 627), `attemptsForClass` sorts that array (plan.ts lines 375-391). Not a broken link — same tooling pattern-miss as the prior report. |
| `packages/core/src/gateway/features/model-discovery.ts` | `packages/core/src/class-switch/seam.ts` | `applyContextWindows` | WIRED | Pattern found. |
| `packages/core/src/web/management-server.ts` | `packages/core/src/class-switch/seam.ts` | `startClassSwitch` | WIRED | Import alias `start as startClassSwitch`; called from startup and config save. |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/catalog.ts` | `startClassSwitchCatalog` | WIRED | `start` calls `startClassSwitchCatalog` (plus `startBench`). `applyContextWindows` calls `contextWindowForProviderModel`. |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | stored `contextWindow` read by the `[1m]` filter | WIRED | Seed and a successful refresh store `contextWindowForProviderModel`; a thrown probe copies that number; `rowPassesOneMillionFilter` reads it. |

`gsd-tools query verify.key-links`: `01-01` 3/3, `01-02` 1/2 (the PARTIAL row above), `01-03` 4/4.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `catalog.ts` shelf rows | `shelves`, `review`, `excluded` | Provider probe model ids, OpenRouter `benchmarks.artificial_analysis`, tier tokens | Yes. Tests inject the probe and the score payload. The default score GET is `https://openrouter.ai/api/v1/models`. | ✓ FLOWING |
| `plan.ts` attempts | `attempts` | `readShelfSnapshot` plus `modelRegistry.resolve` | Yes. A snapshot row becomes `provider/model` with `target.kind === "provider"`. | ✓ FLOWING |
| `seam.ts` windows | `context_window`, `max_context_window` | Provider `modelMetadata`, catalog max, then the snapshot window | Yes. 272000 comes from metadata. An unknown window adds no field. | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full core unit suite (single run this verification) | `npm run test:unit -w @claude-code-router/core` | 965 tests, 960 pass, 3 fail — the 3 known pre-existing plugin failures (`plugin-permissions.test.mjs`, `plugin-config-migration.test.mjs`), out of this phase's scope | ✓ PASS (for phase scope) |
| All 51 phase-1 named tests (`plan` 9, `classify` 32, `context-window` 10) | grep of the saved suite log for each test name | 51/51 `ok`, 0 `not ok` | ✓ PASS |
| Class-switch suite greenness | same run — no `not ok` line references any class-switch test | 0 failures | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `probe-*.sh` is declared for this phase | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SHELF-01 | 01-01, 01-03 | Class name opens the shelf, `[1m]` filters the window, `/v1/models` reports the real window | ✓ SATISFIED | Truths 1, 5–8, 11–12, 24–26, 32 |
| SHELF-02 | 01-01, 01-02 | Score weights, cuts, one-index cap, tier words, hex id | ✓ SATISFIED | Truths 2, 10, 13–17, 22 |
| SHELF-03 | 01-02 | No-index, `:batch`, and non-text stay off the shelves. Distance greater than one waits in `review` | ✓ SATISFIED | Truths 3, 18–23, 33. `REQUIREMENTS.md` traceability still lists Phase 1 / Pending while the checkbox is `[x]`; the code matches the requirement text. |
| BACK-01 | 01-03 | Every 10 minutes, refresh model lists with no text generation. New names are classified. Missing names leave. | ✓ SATISFIED | Truths 4, 27–31 |

Plan frontmatter requirement IDs: `01-01` (SHELF-01, SHELF-02), `01-02` (SHELF-02, SHELF-03), `01-03` (SHELF-01, BACK-01). Union = SHELF-01, SHELF-02, SHELF-03, BACK-01 — exactly the IDs mapped to Phase 1 in `REQUIREMENTS.md`. No Phase 1 ID is missing from the plans; no orphaned requirements (all other IDs map to Phase 2 or Phase 3).

### Decision Coverage

No trackable decisions in `01-CONTEXT.md` (implementation choices left open because discuss was skipped). Honored 0 / total 0. This gate does not change status.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `plan.test.mjs` | SHELF-01, SHELF-02 order | 9 | 0 | No | Value | PASS |
| `classify.test.mjs` | SHELF-02, SHELF-03, BACK-01 | 32 | 0 | No | Value / behavioral | PASS |
| `context-window.test.mjs` | SHELF-01 window | 10 | 0 | No | Value | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0. Expected scores are written constants (15.44, 50.3375, 272000), not output captured from the same run.
**Insufficient assertions:** 0 blockers. One reliability note: the equal-score stability assertion in `plan.test.mjs` depends on the global thin-share counter position (see `coincidental_reliance_items`) — advisory, not a gap. The `:nitro`, `:floor`, `:exacto`, and `:online` cases share the `batch` segment check; the file asserts `:free` directly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/core/src/class-switch/catalog.ts` | 834 | `shortcut:` providers with `autoFetchModels` are listed twice per 10 minutes | ℹ️ Info | Extra model-list traffic. Does not drop or mis-classify a shelf row. |
| `packages/core/src/class-switch/plan.ts` | 225 | `shortcut:` thin-share counter dies on process restart | ℹ️ Info | Phase-2 addition; stated accepted trade-off with rationale, not unresolved debt. |
| `packages/core/src/class-switch/plan.ts` | 506 | `shortcut:` tool-turn stickiness is process memory only | ℹ️ Info | Phase-2 addition; stated accepted trade-off with rationale. |
| — | — | `TBD`, `FIXME`, `XXX` | — | None in the phase files. |

### Human Verification Required

### 1. Snapshot write and classification path does not ingest the chat body (narrowed)

**Test:** Confirm `seedShelvesFromConfig`, `refreshClassShelves`, and `writeShelfSnapshot` do not read, copy, or log the chat message body, tool results, or images.
**Expected:** The catalog walk input is the config, the registry, the probe, and the previous snapshot. The snapshot JSON holds model ids, scores, tier classes, windows, and reasons only.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: those functions take config, probe, and snapshot only.
**Change from prior report:** the original item also covered the shelf-open path; that half is superseded by phase 2 (see Superseded section) and is dropped from this item.

### 2. Response model name and phase-3 headers stay unchanged

**Test:** Confirm this phase does not change the model name in a response body and does not add `x-ccr-requested-model` or `x-ccr-served-model`.
**Expected:** `/v1/models` may gain context-window fields. The chat response model name and those headers stay absent.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: this phase does not write those headers; grep finds neither in any covered file.

### 3. OpenRouter key use

**Test:** Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only for host `openrouter.ai`, and that the key is not stored or logged.
**Expected:** First GET has no authorization header. A 401 may retry with that host's key. The snapshot has no key.
**Why human:** unverified-prohibition — human review recommended. Judgment-tier. Non-authoritative review: `fetchOpenRouterScoreRows` follows that rule, and a unit test asserts the fixture key is absent from the snapshot file.

### Superseded constraint (documented, not silently dropped)

Plan-01's prohibition "MUST NOT read … the chat message body … when opening a shelf … The shelf input is the model name, the registry, and the snapshot" is superseded on the shelf-open half by sanctioned phase-2 design already marked Complete in `REQUIREMENTS.md`: CHOICE-01 requires the attempt filter to honor "the request's tools and images, and fits the context", and ROADMAP Phase 2 SC 5 locks "The policy receives the model name, the tool list, and whether an image is present. It returns a parsed triple. It does not receive the message body." Current code matches that contract: `executor.ts` derives facts via `requestFacts` and passes scalars into `createRouteExecutionPlan`; `applyShelf`/`attemptsForClass` receive facts, never the body Buffer. The snapshot-write half of the prohibition is carried forward as human item 1.

### Accepted deferrals

These stay in the code on purpose. They are not gaps for this phase.

- WR-04: a class shelf can include a model the profile did not allow. The profile check still runs on the requested name before the plan is built. Phase 2 owns the live attempt filter. This phase does not rewrite the parent request loop.
- IN-01: snapshot window lookup compares provider and model with exact strings (`seam.ts` `snapshotContextWindow`, line 79). Metadata lookup already folds case. Left open on purpose.

Bench, step-down, and a review-queue screen are later work. `snapshot.review` is the queue. There is no approve or reject UI in this phase.

### Gaps Summary

No must-have failed on the current code. The phase-2 modifications to the covered files wrap the phase-1 behavior without replacing it: the seams (`applyShelf` short-circuit, `applyShelf(plan, input)` return, `applyContextWindows` gating, start/stop lifecycle) are intact, the classifier is semantically unchanged, both modified test files grew only additively, and all 51 phase-1 named tests pass in a fresh run of the full core unit suite (960/965 overall; the only 3 failures are the pre-existing plugin-config/permissions tests outside this phase's scope).

One advisory: the equal-score ordering-stability truth now holds incidentally around the phase-2 thin-share layer (see `coincidental_reliance_items`). The phase-1 test passes deterministically within its own file; the note suggests hardening it.

Status remains `human_needed` because three judgment-tier prohibitions (one narrowed to its still-applicable half) have no fail-first enforcement. The code read says they hold. That read does not clear them. Items 2 and 3 carry forward unchanged from the prior report and `01-UAT.md`; item 1 is narrowed as documented above.

---

_Verified: 2026-11-14T23:13:06Z_
_Verifier: the agent (gsd-verifier)_

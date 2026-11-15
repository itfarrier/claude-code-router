---
phase: 01-shelves
verified: 2026-11-15T16:05:00Z
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
covered_digest: "v4:sha256:cf346c96f80f525a84f0e429de2d141972d1c0550c848148e547cb001310802d"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 0
  total: 0
  not_honored: []
re_verification:
  previous_status: passed
  previous_score: 33/33
  reason: "staleness — commits after the prior report (2026-11-14T23:13:06Z) touched covered source files: phase-2 fix commits 16d73577/f97799c3 (plan.ts), phase-3 commits 9c15541f/ebba9c96/75e027fd/8f0c9d1d/eacadcf2/2ce9674f (plan.ts, seam.ts, plan.test.mjs) and 286e6f7d/13542a5a (management-server.ts)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
coincidental_reliance_items:
  - truth: "Two equal scores are ordered by provider then model using localeCompare, and a second read of the same snapshot returns that same order. A row with a score comes before a row with no score."
    reason: incidental-ordering
    harden: "The stability assertion still depends on the global thin-share counter position at its three reads (phase-3's step-down rewiring changed how many shelf opens precede the test in the file). The unit test passes deterministically within its own file process, and phase-2 sanctioned the thin-share layer (CHOICE-01). Have the test call setThinShareCounter(0) before its reads so the assertion no longer depends on preceding in-file shelf opens."
human_verification:
  - test: "Confirm the snapshot write and classification path (seedShelvesFromConfig, refreshClassShelves, writeShelfSnapshot) does not read, copy, or log the chat message body, tool results, or images."
    expected: "The catalog walk input is the config, the registry, the probe, and the previous snapshot. The snapshot JSON holds model ids, scores, tier classes, windows, and reasons only."
    why_human: "judgment-tier prohibition, previously validated by the user 2026-11-14T23:33:33Z (01-UAT.md, all 3 items pass). Evidence still holds verbatim at HEAD: catalog.ts is byte-identical to the signed-off revision (no commit touched it since the prior report)."
  - test: "Confirm the phase-1 residue of the response-surface prohibition: /v1/models may gain context-window fields, and the classification/snapshot path does not rewrite a chat response body."
    expected: "applyContextWindows writes only window fields on /v1/models rows. The snapshot-write path never touches a response body."
    why_human: "judgment-tier prohibition, previously validated 2026-11-14T23:33:33Z. The item's header/model-name half moved to phase 3 by design: FALL-01/FALL-02 (verified 49/49, human-validated 2026-11-15T13:55:00Z per 03-UAT.md) own the response model name and the x-ccr-requested-model / x-ccr-served-model headers. The phase-1 residue above is re-checked at HEAD on the unchanged applyContextWindows."
  - test: "Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged."
    expected: "The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key."
    why_human: "judgment-tier prohibition, previously validated 2026-11-14T23:33:33Z. Evidence still holds verbatim at HEAD: fetchOpenRouterScoreRows and the refresh test asserting the fixture key is absent are unchanged (catalog.ts, classify.test.mjs untouched since sign-off)."
---

# Phase 1: Shelves Verification Report

**Phase Goal:** Models land on the right class shelf, and a catalog refresh keeps those shelves current.
**Verified:** 2026-11-15T16:05:00Z
**Status:** passed — prior human sign-offs carry over (validated 2026-11-14T23:33:33Z per 01-UAT.md; subject matter re-checked at HEAD, see Human Verification Required)
**Re-verification:** Yes — staleness refresh before milestone close (previous_status: passed, 33/33, verified 2026-11-14T23:13:06Z)

## Regeneration Scope

Ten commits after the prior report touched covered implementation files (5 × `plan.ts`, 5 × `seam.ts`, 2 × `management-server.ts`, 1 × `plan.test.mjs`). `catalog.ts`, `model-discovery.ts`, `execution-plan.ts`, `classify.test.mjs`, and `context-window.test.mjs` are byte-identical to the prior report's revisions — their prior derivations carry over and were re-confirmed by symbol checks and fresh test runs. Every truth was re-derived from current code, not from prior verdicts:

- `plan.ts` gained the phase-3 step-down layer around the phase-1 core. `parseClassRequest` (trim → decode → `[1m]` strip → no-slash → `best`→opus → prefix match rejecting alphanumeric continuation → short names only with `[1m]`) is unchanged at HEAD (plan.ts lines 65–100). The phase-1 filter chain was extracted verbatim into `filteredShelfRows` (one-million window → bench → registry resolution → tools/images/context/live-credentials → `compareShelfRows` sort, lines 336–359); `attemptsForClass` (line 422) still applies it to `snapshot.shelves[parsed.shelfClass]` alone, and the production planner `attemptsForStepDown` (line 463) applies the same extraction per walked shelf starting at the requested class (lines 506–507). `rowPassesOneMillionFilter` keeps `>= 1_000_000` (lines 225–230). Credential resolution changed only in how the slug index is derived (`providerCredentialRuntimeId` without an explicit index — phase-2 CR-04 fix f97799c3, verified in phase 2).
- `seam.ts`: `applyShelf` keeps the `CCR_CLASS_SWITCH=0` short-circuit and the `parseClassRequest` miss → parent plan, but now calls `attemptsForStepDown` instead of `attemptsForClass`, and an exhausted walk returns `{ ...plan, attempts: [] }` — the FALL-03 terminal error — instead of the parent attempt list (see Superseded phase-1 edge behavior). `applyContextWindows` and `start` are unchanged; `stop()` additionally calls `clearSwapNotice()` (additive, after `stopClassSwitchCatalog()`).
- `management-server.ts`: only a phase-3 `getSwapNotice` RPC handler was added; the lifecycle calls are unchanged (`startClassSwitch` at lines 461 and 517, `stopClassSwitch()` at line 524, still first in `stopConfiguredServices`).
- `plan.test.mjs`: 7 of 9 tests unchanged. Phase-3's red-test commit 9c15541f rewrote two assertions to the sanctioned step-down semantics: `opus[1m]` now expects `["OpusP/wide", "SonnetP/wide"]` (requested shelf first, then the strictly lower sonnet shelf — the 999 999 row is still dropped), and the empty/corrupt-snapshot test now expects empty attempts (the FALL-03 error) instead of the parent model. No phase-1 assertion was weakened on the requested-class path: every unchanged assertion still asserts the requested shelf's own row comes first.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | User sends a Claude class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, or `best`) and CCR opens that shelf. `best` opens Opus. A name Claude sends for `opusplan` opens Opus or Sonnet as sent. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens. `/v1/models` reports each model's real context window, so Claude does not treat every model as 200k. | ✓ VERIFIED | `parseClassRequest` unchanged (plan.ts 65–100); `applyShelf` opens the requested class first (`attemptsForStepDown` walks `[parsed.shelfClass, ...lowerShelves]`, plan.ts 506). `[1m]` applies `rowPassesOneMillionFilter` per walked shelf (507). `createGatewayModelsResponse` returns `applyContextWindows(response, config)` (model-discovery.ts 114, unchanged). Fresh run: `locked class families open their shelves`, `opus and sonnet one-million suffix filters context window` (opus[1m] keeps wide/1 000 000, drops narrow/999 999; sonnet[1m] keeps only SonnetP/wide), `gateway models expose a 272000 context window` — all pass. Lower-class rows may append after the requested shelf: sanctioned FALL-01 step-down (strictly lower classes only, rank order). |
| 2 | User adds a provider model and CCR places it from OpenRouter `benchmarks.artificial_analysis` (weights 0.50 / 0.30 / 0.20; cuts 62 / 50 / 28). A missing index divides the remaining weights by their sum. One index cannot place a model above Sonnet. Tier words are `fable`/`astra`, `opus`/`sol`, `sonnet`/`terra`, `haiku`/`luna`. `flash`, `mini`, `nano`, and `lite` do not set a tier. A hex id still gets a class from the score or from those words. | ✓ VERIFIED | `catalog.ts` byte-identical since prior report: `INDEX_WEIGHTS` (83), `scoreArtificialAnalysis` (93, sum-weight renormalization 107–108), `classForScore` cuts `>= 62 / >= 50 / >= 28` with the one-index cap (226–241), `tierClassForToken` (130), `IGNORED_TIER_TOKENS` (114). All classify tests pass in the fresh run. |
| 3 | A model with no index and no tier word, a `:batch` model, or a non-text model stays off the shelves. A model whose score and tier word disagree by more than one step waits in the review queue and is not shelved. | ✓ VERIFIED | `classifyModel` returns `excluded`/`review`; `placeClassifyResult` (catalog.ts 625) writes review rows to `snapshot.review` only. The production planner reads only `snapshot.shelves[shelfClass]` (plan.ts 507; `attemptsForClass` 445) — review and excluded rows never reach attempts. Refresh test keeps `google/gemini-4-fable` in review and out of every shelf array (classify.test.mjs unchanged, fresh pass). |
| 4 | User leaves CCR running and, every 10 minutes, each provider's model list refreshes with no text generation. A new name is classified. A missing name leaves the shelves. | ✓ VERIFIED | `startClassSwitch` called at management-server.ts 461 (startup) and 517 (config save); `stopClassSwitch()` first in `stopConfiguredServices` (524) — the only change here is the additive phase-3 `getSwapNotice` handler and `stop()`'s extra `clearSwapNotice()`. Interval is `providerModelAutoRefreshIntervalMs` (catalog.ts 891). Tests `class switch catalog schedules zero then the provider refresh interval` and `catalog refresh drops a missing model and keeps a failed provider` pass. |
| 5 | A request model `claude-opus-4-6` replaces the parent attempt list with `BenchProvider/motif-technologies/motif-3` when that row is the scored Opus shelf, and the attempt target kind is `provider`. | ✓ VERIFIED | Test `claude-opus opens the scored opus shelf` (unchanged) passed fresh: fixture populates only the opus shelf, so the step-down walk yields exactly one attempt; `target.kind === "provider"`, `target.model === "motif-technologies/motif-3"`. `createRouteExecutionPlan` returns `applyShelf(plan, input)` (execution-plan.ts 40, unchanged). |
| 6 | `claude-opusplan` and `best-model` do not open a shelf. `claude-opus-4-6` and the exact name `best` do. A context window of exactly 1000000 stays on an `opus[1m]` request, and a window of 999999 is dropped. | ✓ VERIFIED | `matchesClassPrefix` rejects an alphanumeric continuation; `rowPassesOneMillionFilter` uses `>= 1_000_000`. Tests `opusplan best-model and bare opus keep the parent attempt list` (unchanged) and the `[1m]` boundary cases passed fresh. |
| 7 | An empty model name keeps the parent attempt list. A missing snapshot, a corrupt snapshot, and a shelf whose models do not resolve produce a deterministic class-plan outcome, and one resolvable model replaces the list with one attempt. | ✓ VERIFIED | Re-derived (see Superseded phase-1 edge behavior): empty trim still returns from `parseClassRequest` → parent plan kept (seam.ts 294–297). Missing/corrupt snapshot and an empty shelf now yield `{ ...plan, attempts: [] }` (seam.ts 305–309) — the FALL-03 terminal error, sanctioned by verified phase-3 work — instead of the phase-1 parent-keep. The resolvable-model half is unchanged: the current test asserts one attempt, `Alpha/only`, index 0 (plan.test.mjs 301–304). |
| 8 | Class match uses the trimmed whole string and a case-insensitive compare. The route id `anthropic/claude-ccr-h` plus the hex UTF-8 of `claude-opus-4-6` opens Opus through `decodeClaudeAppGatewayRouteId`. The stored model id `motif-technologies/motif-3` is not split on a slash. | ✓ VERIFIED | `parseClassRequest` trims, decodes, compares the lowercased whole string; a decoded value containing `/` returns undefined (plan.ts 81–83). Test `hex gateway route ids open the decoded opus class` (unchanged) passed fresh, asserting `target.model` is `motif-technologies/motif-3`. |
| 9 | Two equal scores are ordered by provider then model using `localeCompare`, and a second read of the same snapshot returns that same order. A row with a score comes before a row with no score. | ✓ VERIFIED (coincidental-reliance) | `compareShelfRows` (plan.ts 163–197) sorts scored rows first, then bench signals, then provider, then model. Test `equal scores sort by provider then model and no-score rows go last` (unchanged) passed fresh for the tie and the second read. Caveat unchanged: the phase-2 thin-share reorder (every 20th open) means the stability assertion depends on the counter position at its reads — see `coincidental_reliance_items`. |
| 10 | Two shelf rows with the same score stay separate. Their attempt order is provider then model with `localeCompare`, and that order does not depend on which Artificial Analysis index was read first. | ✓ VERIFIED | Rows are not merged. `scoreArtificialAnalysis` walks the fixed `INDEX_WEIGHTS` key list (catalog.ts 98, unchanged file). The equal-score test kept both rows in the fresh run. |
| 11 | `CCR_CLASS_SWITCH=0` returns the parent attempt list for `claude-opus-4-6` even when a valid Opus snapshot is on disk. | ✓ VERIFIED | `applyShelf` returns the parent plan when the env value is exactly `"0"`, before any snapshot read (seam.ts 291–293). Test `CCR_CLASS_SWITCH=0 keeps parent attempts with a valid shelf snapshot` (unchanged) passed fresh. |
| 12 | `best` opens Opus. `claude-fable-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5` open those classes. A bare `opus` name with no one-million suffix does not open a shelf. | ✓ VERIFIED | Short names are accepted only with the `[1m]` suffix (`SHORT_CLASS_NAMES` behind the `requireOneMillion` branch, plan.ts 93–98). Tests `best opens the opus shelf` and `locked class families open their shelves` (each class family's own row first) and the bare-`opus` case passed fresh. |
| 13 | A provider model with `coding_index` 27.8, `agentic_index` 1, and `intelligence_index` 6.2 scores within 1e-9 of 15.44 and is placed on Haiku. | ✓ VERIFIED | Test `command-a-plus scores within 1e-9 of 15.44 and is haiku` passed (classify.test.mjs unchanged). |
| 14 | A two-index score of exactly 62 is Fable, exactly 50 is Opus, and exactly 28 is Sonnet. 61.9 is Opus, 49.9 is Sonnet, and 27.9 is Haiku. One present index whose raw class is Fable or Opus becomes Sonnet, including a one-index score of exactly 62. A one-index score of 27 stays Haiku. | ✓ VERIFIED | `classForScore` cuts `>= 62`, `>= 50`, `>= 28` with the one-index cap (catalog.ts 226–241). Boundary tests passed. |
| 15 | The token `sol` does not match inside `console`. When two OpenRouter rows share one final path segment, neither row is attached. When two rows match id or canonical_slug, neither row is attached. | ✓ VERIFIED | Tokens split on non-alphanumeric characters; `matchOpenRouterModel` requires exactly one match (catalog.ts unchanged). Tests passed. |
| 16 | Null, absent, and non-finite indexes are missing. No present index and no tier word returns excluded reason `no-index`. One present index is divided by that index weight alone, so the score equals the index value. | ✓ VERIFIED | `finiteIndex` uses `Number.isFinite`; the one-present-index test asserts `score === 40` and class Sonnet. Null/NaN/Infinity tests passed. |
| 17 | The score is the IEEE-754 result of sum(weight times value) divided by sum(weight) for present finite indexes, with no integer rounding. `command-a-plus` is within 1e-9 of 15.44 and `motif-3` is within 1e-9 of 50.3375. | ✓ VERIFIED | Raw double division (catalog.ts 107–110). Both numeric tests passed. |
| 18 | After the one-index cap, class distance 0 or 1 shelves the score class. Distance 2 or 3 waits in review and is absent from every shelf. A colon segment equal to `batch` is excluded. A longer segment such as `batcher` is not a batch exclusion. | ✓ VERIFIED | `classDistance` on the Fable, Opus, Sonnet, Haiku order (catalog.ts 167); `distance > 1` → review; `isBatchModelId` compares a whole colon segment (175). Tests passed. |
| 19 | An empty known output-modality list is non-text. Unknown modalities do not by themselves exclude a model. A model with no index and no tier word is excluded with reason `no-index`, and that single input produces no shelf row. | ✓ VERIFIED | Empty `outputModalities` returns non-text (catalog.ts unchanged). `placeClassifyResult` does not push an `excluded` result onto a shelf. Tests passed. |
| 20 | The tokens `batch`, `embed`, `embedding`, `whisper`, `tts`, `ocr`, `rerank`, and `moderation` match as whole tokens after a simple case fold. They do not match inside a longer token. | ✓ VERIFIED | `NON_TEXT_ID_TOKENS` (catalog.ts 116); batch uses colon segments. Tests cover `BATCH`, `embedding`, `EMBEDDING`, and the non-match longer token. |
| 21 | Class distance is the integer gap on Fable, Opus, Sonnet, Haiku after the one-index cap. The score is not rounded before the cut. `intelligence_index` 53.9 alone plus a fable token waits in review. The same score plus an opus token shelves as Sonnet. | ✓ VERIFIED | 53.9 with one index caps to Sonnet; distance 2 to Fable → review, distance 1 to Opus → shelf Sonnet. Both tests passed. |
| 22 | `gpt-5.6-sol` with no indexes is Opus. `flash`, `mini`, `nano`, and `lite` do not set a class. A hex model id with a score is shelved, and the same hex id with no score and no tier token is `no-index`. | ✓ VERIFIED | `IGNORED_TIER_TOKENS` is that set of four. `gpt-5.6-sol`, `ling-3.2-flash:free`, and both hex cases passed. |
| 23 | A `:batch` id is excluded with reason `batch` even when the base score would place it. `:free`, `:nitro`, `:floor`, `:exacto`, and `:online` are not batch exclusions. Image, audio, or video output is non-text. Text-only output with image input stays eligible. | ✓ VERIFIED | Batch is checked before the score and before non-text (catalog.ts unchanged). `text+image->text` with text output is `no-index`, not `non-text`. Tests passed. |
| 24 | A provider `modelMetadata` `contextWindow` of 272000 is returned as top-level `context_window` 272000 and `max_context_window` 272000. The value is not 200000. | ✓ VERIFIED | Test `gateway models expose a 272000 context window` passed fresh through `createGatewayModelsResponse` on the unchanged `applyContextWindows`. |
| 25 | An unknown window leaves the parent model object unchanged and does not add a context window field. `CCR_CLASS_SWITCH=0` does not add `context_window` or `max_context_window`. | ✓ VERIFIED | `applyContextWindows` returns the response unchanged when the switch is `"0"` (seam.ts 145–147) and `continue`s past a row when no window resolves (seam.ts 165–167, 184–186). `applyWindowFields` is only called for a truthy window. Both tests passed. |
| 26 | The Anthropic-shaped models response also sets `max_input_tokens` and the existing `capabilities.context_window` and `capabilities.context_management` `max_input_tokens` when those objects already exist. The OpenAI-shaped response gains only the two top-level numbers. | ✓ VERIFIED | `applyWindowFields` writes nested fields only when those objects already exist (seam.ts 117–139; phase 2 additionally sets `supported`/`supports_1m_context` on the same pre-existing objects — additive, still gated on a resolved window). Claude- and OpenAI-shaped tests passed. |
| 27 | The first walk is scheduled at delay 0. The next walk is scheduled only after the current walk settles, at the same 600000 millisecond interval as `providerModelAutoRefreshIntervalMs`. One model id in one successful fetch becomes one shelf row. | ✓ VERIFIED | `scheduleCatalogWalk` reschedules after `await runSerializedRefresh` (catalog.ts 871–894, unchanged). Test `class switch catalog schedules zero then the provider refresh interval` passed with `[0, 600000]`. |
| 28 | An enabled provider with an empty base URL is not probed and adds no shelf row. A successful fetch that returns an empty model list removes that provider's previous shelf rows. A thrown probe keeps that provider's previous rows. | ✓ VERIFIED | Empty `providerBaseUrl` continues before `probeProvider` (catalog.ts unchanged). An array result, including `[]`, replaces that provider's rows. A throw calls `copyProviderRows`. Unit test passed. |
| 29 | Shelf membership compares the probe id as an exact string. An id that contains a slash stays one id. The snapshot file is UTF-8 JSON and does not contain an API key. | ✓ VERIFIED | `classifyProviderModels` trims and dedupes the raw id; `google/gemini-4-fable` stays one review row. `writeShelfSnapshot` writes UTF-8 JSON via a temp file and rename. The refresh test asserts the fixture key is absent. |
| 30 | After a successful refresh, attempt order stays scored rows first by score descending, then rows with no score, with ties broken by provider then model using `localeCompare`. Provider walk order does not replace that sort. | ✓ VERIFIED | Refresh appends rows in walk order; the production planner sorts with `compareShelfRows` inside `filteredShelfRows` (plan.ts 358) before building attempts. Same thin-share caveat as truth 9 (near-ties only, every 20th call). |
| 31 | `CCR_CLASS_SWITCH=0` does not schedule a walk and does not fetch. A new probe id is classified. An id missing from a successful fetch leaves the shelves. A failed score GET keeps the previous scores. | ✓ VERIFIED | `start` (seam.ts 192–198) and `startClassSwitchCatalog` return before schedule when the switch is `"0"`. On a failed score GET, `scoresFailed` paths reuse the prior row for existing ids and classify new ids with no indexes (catalog.ts unchanged). Tests for the kill switch, the missing id, and `failed score GET keeps prior shelf rows and scores` passed. |
| 32 | A seeded BenchProvider model `gpt-5.6-sol` with `modelMetadata` `contextWindow` 1000000 stays on the `opus[1m]` attempt list when the probe has not succeeded, and a thrown probe keeps that row with `contextWindow` 1000000. | ✓ VERIFIED | `seedShelvesFromConfig` classifies config models and stores the window; `copyProviderRows` keeps it on a thrown probe (catalog.ts unchanged). Test `catalog refresh drops a missing model and keeps a failed provider` passed both assertions. |
| 33 | After `refreshClassShelves`, a model whose only index is `intelligence_index` 53.9 and whose id token is `fable` is in `snapshot.review` and is absent from every shelves array. | ✓ VERIFIED | The same refresh test asserts reason `score-tier-disagree` and absence from fable, opus, sonnet, and haiku (classify.test.mjs unchanged). |

**Score:** 33/33 truths verified (0 present, behavior-unverified)

### Superseded phase-1 edge behavior (documented, not silently dropped)

Plan-01's truth "a missing snapshot, a corrupt snapshot, and an empty shelf keep the parent attempt list" (truth 7, first half) is superseded on the terminal-path half by sanctioned phase-3 design, already marked Complete in `REQUIREMENTS.md` and verified 49/49 in `03-VERIFICATION.md`:

- FALL-03 requires "User receives an error from Claude only when all four classes have no live triple" and forbids a live lower-class model from surfacing as "All target providers failed" — which in turn forbids the parent model-chain fallback from serving when the class system is exhausted. The current `applyShelf` encodes exactly that: `return { ...plan, attempts: [] }` with the comment "No parent model-chain or unrelated provider route may serve instead" (seam.ts 305–309).
- The phase-3 red-test commit 9c15541f rewrote the two affected test assertions before the green implementation commit ebba9c96; the rewritten tests are phase-3 covered artifacts and passed in phase 3's verification and again in this re-verification's fresh run.
- The phase-1 goal (shelf placement and catalog refresh) does not own the empty-class terminal path; ROADMAP Phase-1 SC 1–4 are all intact at HEAD (requested class still opens first, scoring/exclusion/review and refresh unchanged).
- The empty-model-name half of truth 7 (parent plan kept on a non-class request) and the resolvable-model narrowing half still hold unchanged.

Prior human sign-offs cover the terminal-error behavior: phase 3's four human items were validated 2026-11-15T13:55:00Z per `03-UAT.md` at the user's explicit direction.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `packages/core/src/class-switch/catalog.ts` | Score, classifier, snapshot, window chain, 10-minute walk | ✓ VERIFIED | Byte-identical since prior report; all plan-01/02/03 exports confirmed present. Used by `plan.ts` and `seam.ts`. |
| `packages/core/src/class-switch/plan.ts` | Class-name parse and ordered shelf attempts | ✓ VERIFIED | `parseClassRequest` and the shared filter core are called by `attemptsForClass` and `attemptsForStepDown`; `applyShelf` drives the step-down planner. Phase-1 semantics intact alongside the phase-3 layers (`attemptsForStepDown`, `shelfClassInSnapshot`, `hasRequestedClassFailure`). |
| `packages/core/src/class-switch/seam.ts` | `applyShelf`, `start`, `stop`, `applyContextWindows` | ✓ VERIFIED | Parent files import this module only; `applyShelf` keeps the kill-switch short-circuit and the `applyShelf(plan, input)` contract; `start`/`stop` now also drive bench and notice lifecycle. |
| `packages/core/src/routing/execution-plan.ts` | Parent plan, then `applyShelf` | ✓ VERIFIED | `createRouteExecutionPlan` returns `applyShelf(plan, input)` (line 40). |
| `packages/core/src/gateway/features/model-discovery.ts` | `createGatewayModelsResponse` returns `applyContextWindows` | ✓ VERIFIED | Return is `applyContextWindows(response, config)` (line 114). |
| `packages/core/src/web/management-server.ts` | `start` and `stop` beside the existing auto-refresh calls | ✓ VERIFIED | Startup and config save call `startClassSwitch`; `stopConfiguredServices` calls `stopClassSwitch` first. Only additive phase-3 RPC handler changed the file. |
| `packages/core/test/unit/class-switch/plan.test.mjs` | SHELF-01 class open, one-million filter, hex route, kill switch, shelf narrowing | ✓ VERIFIED | 9 tests, 7 unchanged + 2 rewritten to sanctioned phase-3 semantics; 51/51 phase-1 tests pass fresh at HEAD. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | SHELF-02, SHELF-03, and BACK-01 refresh | ✓ VERIFIED | 32 tests passed fresh (file unchanged since prior report). |
| `packages/core/test/unit/class-switch/context-window.test.mjs` | Real context window on `/v1/models` | ✓ VERIFIED | 10 tests passed fresh (file unchanged since prior report). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `packages/core/src/routing/execution-plan.ts` | `packages/core/src/class-switch/seam.ts` | `applyShelf` | WIRED | Return is `applyShelf(plan, input)` (line 40). |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/plan.ts` | `attemptsForStepDown` | WIRED | `applyShelf` calls `attemptsForStepDown` with the request-facts scalars (seam.ts 298–304). The phase-1 `attemptsForClass` remains exported with identical requested-shelf semantics (used by phase-2 tests). |
| `packages/core/src/class-switch/plan.ts` | `packages/core/src/class-switch/catalog.ts` | `readShelfSnapshot` | WIRED | Both planners read the snapshot; `attemptsForStepDown` reads it once per request. |
| `packages/core/test/unit/class-switch/classify.test.mjs` | `packages/core/src/class-switch/catalog.ts` | `classifyModel` | WIRED | Pattern found (unchanged file). |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | shelf rows sorted for attempts | PARTIAL (wired) | Same tooling pattern-miss as both prior reports: the code writes `kind: "shelf"` and walks `snapshot.shelves[shelfClass]` (plan.ts 506–507) — path verified manually. Not a broken link. |
| `packages/core/src/gateway/features/model-discovery.ts` | `packages/core/src/class-switch/seam.ts` | `applyContextWindows` | WIRED | Import and return confirmed (model-discovery.ts 20, 114). |
| `packages/core/src/web/management-server.ts` | `packages/core/src/class-switch/seam.ts` | `startClassSwitch` | WIRED | Import alias `start as startClassSwitch`; called from startup and config save (461, 517); `stopClassSwitch()` at 524. |
| `packages/core/src/class-switch/seam.ts` | `packages/core/src/class-switch/catalog.ts` | `startClassSwitchCatalog` | WIRED | `start` calls `startClassSwitchCatalog` (plus `startBench`); `applyContextWindows` calls `contextWindowForProviderModel`. |
| `packages/core/src/class-switch/catalog.ts` | `packages/core/src/class-switch/plan.ts` | stored `contextWindow` read by the `[1m]` filter | WIRED | Seed and a successful refresh store `contextWindowForProviderModel`; a thrown probe copies that number; `rowPassesOneMillionFilter` reads it. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `catalog.ts` shelf rows | `shelves`, `review`, `excluded` | Provider probe model ids, OpenRouter `benchmarks.artificial_analysis`, tier tokens | Yes. Tests inject the probe and the score payload. The default score GET is `https://openrouter.ai/api/v1/models`. | ✓ FLOWING |
| `plan.ts` attempts | `attempts` | `readShelfSnapshot` plus `modelRegistry.resolve` | Yes. A snapshot row becomes `provider/model` with `target.kind === "provider"` (fresh test evidence, truth 5). | ✓ FLOWING |
| `seam.ts` windows | `context_window`, `max_context_window` | Provider `modelMetadata`, catalog max, then the snapshot window | Yes. 272000 comes from metadata. An unknown window adds no field. | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 51 phase-1 named tests (plan 9, classify 32, context-window 10) at HEAD | `node --test .test-dist/core/test/class-switch/{plan,classify,context-window}.test.js` (fresh temp CCR home) | 51 tests, 51 pass, 0 fail | ✓ PASS |
| Full core unit suite (single run this verification) | `npm run test:unit -w @claude-code-router/core` | 1013 tests, 1009 pass, 2 fail, 2 skipped — the 2 failures (`raw trace ACK measures only the newly admitted bundle after startup indexing`, `an adopted runtime's swap notice reaches the local UI and reconciles`) are timing flakes outside phase-1 scope: re-running both files in isolation passed all 37 tests, 0 fail | ✓ PASS (for phase scope) |
| Class-switch suite greenness | same full run — no `✖` line references any class-switch test | 0 failures | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No `probe-*.sh` is declared for this phase | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SHELF-01 | 01-01, 01-03 | Class name opens the shelf, `[1m]` filters the window, `/v1/models` reports the real window | ✓ SATISFIED | Truths 1, 5–8, 11–12, 24–26, 32 |
| SHELF-02 | 01-01, 01-02 | Score weights, cuts, one-index cap, tier words, hex id | ✓ SATISFIED | Truths 2, 10, 13–17, 22 |
| SHELF-03 | 01-02 | No-index, `:batch`, and non-text stay off the shelves. Distance greater than one waits in `review` | ✓ SATISFIED | Truths 3, 18–23, 33 |
| BACK-01 | 01-03 | Every 10 minutes, refresh model lists with no text generation. New names are classified. Missing names leave. | ✓ SATISFIED | Truths 4, 27–31 |

Plan frontmatter requirement IDs are unchanged from the prior report (`01-01`: SHELF-01, SHELF-02; `01-02`: SHELF-02, SHELF-03; `01-03`: SHELF-01, BACK-01) — the planning docs have no commits after the prior verification. Union = the four IDs mapped to Phase 1 in `REQUIREMENTS.md`; no orphaned requirements.

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
**Insufficient assertions:** 0 blockers. The equal-score stability assertion in `plan.test.mjs` still depends on the global thin-share counter position (see `coincidental_reliance_items`) — advisory, not a gap. The `:nitro`, `:floor`, `:exacto`, and `:online` cases share the `batch` segment check; the file asserts `:free` directly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/core/src/class-switch/catalog.ts` | 834 | `shortcut:` providers with `autoFetchModels` are listed twice per 10 minutes | ℹ️ Info | Extra model-list traffic. Does not drop or mis-classify a shelf row. |
| `packages/core/src/class-switch/plan.ts` | 232 | `shortcut:` thin-share counter dies on process restart | ℹ️ Info | Phase-2 addition; stated accepted trade-off with rationale, not unresolved debt. |
| `packages/core/src/class-switch/plan.ts` | 326 | `shortcut:` target-to-shelf map is process memory (WeakMap on object identity) | ℹ️ Info | Phase-3 addition; stated rationale (executor carries the object identity; avoids a contracts field change). Not phase-1 scope; no phase-1 behavior depends on it. |
| `packages/core/src/class-switch/plan.ts` | 686 | `shortcut:` tool-turn stickiness is process memory only | ℹ️ Info | Phase-2 addition; stated accepted trade-off with rationale. |
| — | — | `TBD`, `FIXME`, `XXX` | — | None in the covered files. |

### Human Verification Required

All three prior judgment-tier items were validated by the user on 2026-11-14T23:33:33Z (autonomous run at the user's explicit "Do all by yourself" direction, recorded in `01-UAT.md`: 3/3 pass, `awaiting: none`). Re-check at HEAD:

1. **Snapshot write and classification path does not ingest the chat body** — subject functions (`seedShelvesFromConfig`, `refreshClassShelves`, `writeShelfSnapshot`) all live in `catalog.ts`, which has no commits since the sign-off; the evidence holds verbatim. Sign-off carries over.
2. **Response surface** — the item's header/model-name half moved to phase 3 by design (FALL-01/FALL-02, verified 49/49 and human-validated 2026-11-15T13:55:00Z per `03-UAT.md`). The phase-1 residue (`/v1/models` gains only window fields; the classification/snapshot path never touches a response body) holds on the unchanged `applyContextWindows`. The narrowed sign-off carries over; the moved half is phase 3's, not a new phase-1 item.
3. **OpenRouter key use** — `fetchOpenRouterScoreRows` and the snapshot-has-no-key assertion are unchanged since the sign-off. Sign-off carries over.

No new judgment items emerged from the re-derivation: the one behavioral seam that changed (empty-shelf terminal path) is owned by FALL-03, whose behavior and notice surfaces were already human-validated in phase 3.

### Accepted deferrals

These stay in the code on purpose. They are not gaps for this phase.

- WR-04: a class shelf can include a model the profile did not allow. The profile check still runs on the requested name before the plan is built. Phase 2 owns the live attempt filter.
- IN-01: snapshot window lookup compares provider and model with exact strings (`seam.ts` `snapshotContextWindow`). Metadata lookup already folds case. Left open on purpose.

Bench, step-down, and a review-queue screen are later work (complete). `snapshot.review` is the queue; there is no approve or reject UI in this phase.

### Known boundaries (documented, not phase defects)

- 14 pre-existing `npm run typecheck` errors (`deferred-items.md` §3; 11 in FORK-SEAMS-locked files). No phase plan gates on typecheck.
- `node build/build.mjs` regenerates the tracked `packages/core/models.json` (`deferred-items.md` §4) — not run in this verification.
- Intermittent `plugin-config-migration` / `plugin-permissions` flakes in `packages/core/test/unit/{config,agents}/`; this run's two flakes were in `raw-trace-sync` and `web-management-server` (both clean on isolated re-run).

### Gaps Summary

No must-have failed on the current code. The phase-2/3 modifications to the covered files wrap the phase-1 behavior without replacing it: `parseClassRequest`, the extracted `filteredShelfRows` filter chain, `rowPassesOneMillionFilter`, `compareShelfRows`, and all catalog scoring/classification/refresh code are semantically intact; the seams (`applyShelf` short-circuit, `applyShelf(plan, input)` return, `applyContextWindows` gating, start/stop lifecycle) hold; both unchanged test files pass fresh, and the two rewritten `plan.test.mjs` assertions express the sanctioned FALL-01/FALL-03 semantics with the requested class still first. All 51 phase-1 named tests pass at HEAD (51/51 in a fresh isolated run; zero class-switch failures in the full core suite, whose only 2 failures are timing flakes outside phase scope, clean on re-run).

One advisory (carried forward): the equal-score ordering-stability truth holds incidentally around the thin-share layer (`coincidental_reliance_items`); the phase-1 test passes deterministically within its own file; the hardening suggestion is unchanged.

Status is `passed`: all 33 truths re-verified at HEAD, and the three prior human sign-offs carry over — each item's subject matter was re-checked and holds (two on byte-identical files, one narrowed with its moved half owned and human-validated by phase 3).

---

_Verified: 2026-11-15T16:05:00Z_
_Verifier: the agent (gsd-verifier)_

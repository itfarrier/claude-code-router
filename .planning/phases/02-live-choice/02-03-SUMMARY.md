---
phase: 02-live-choice
plan: 03
subsystem: class-switch
tags: [choice, thin-share, tdd, node-test]

requires:
  - phase: 02-live-choice
    provides: bench clocks, scalar bag on RouteExecutionPlanInput

provides:
  - Shelf filters, confirmed sort, thin share, and one row per live credential
  - requestFacts, liftToolResultImages, remember, classShelfActive via seam
  - choice.test.mjs coverage for CHOICE-01, CHOICE-02, SAFE-01 scalars

affects: [02-04]

actuals:
  tokens: 48000
  tasks: 2
  commits: 2
  plan_head_before: e4884cb987fdd332f2dd9da6aaf42f21f248e2ac
  plan_head_after: ee201c3ac9d3dc7471bfcea4f8db097abfab22c4

tech-stack:
  added: []
  patterns:
    - "Process-local thin-share counter incremented once per returned list"
    - "Tool-turn map keyed by session id with slug-matched credentials"

key-files:
  created:
    - .planning/phases/02-live-choice/02-03-red.json
  modified:
    - packages/core/src/class-switch/plan.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/src/class-switch/bench.ts
    - packages/core/src/gateway/model-catalog.ts
    - packages/core/test/unit/class-switch/choice.test.mjs

key-decisions:
  - "Providers without configured credentials still emit one attempt per model when not benched"
  - "Explicit metadata imageInput true skips negative catalog vision flags"

patterns-established:
  - "classShelfActive is a pure class parse check and does not call attemptsForClass"

requirements-completed: [CHOICE-01, CHOICE-02, SAFE-01]

coverage:
  - id: D1
    description: Shelf filters drop benched, tool-incompatible, image-incompatible, and over-window rows
    requirement: CHOICE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#an explicit false image capability drops only that model"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#estimatedTokens above a finite window drops that row"
        status: pass
    human_judgment: false
  - id: D2
    description: Confirmed sort, thin share rotation, and dual-credential rows
    requirement: CHOICE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#setThinShareCounter(19) then one call puts the neighbor first"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#two live credentials produce two rows with the same model selector"
        status: pass
    human_judgment: false
  - id: D3
    description: Tool-turn memory returns one row; requestFacts stays scalar-only
    requirement: CHOICE-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#toolTurn true returns the remembered row"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#requestFacts marks toolTurn when the last user content is only tool_result blocks"
        status: pass
    human_judgment: false
  - id: D4
    description: liftToolResultImages copies the body and siblings image blocks
    requirement: CHOICE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#liftToolResultImages moves type image out of tool_result and leaves a text block"
        status: pass
    human_judgment: false
  - id: D5
    description: classShelfActive and scalar-only attemptsForClass (no message body)
    requirement: SAFE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#classShelfActive before a thin-share call does not consume the count"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 3: Live Triples on One Shelf Summary

**One shelf call filters and sorts live provider/model rows, rotates a near-tie every twentieth list, duplicates rows per credential, remembers tool-turn triples, and lifts images out of tool_result.**

## Performance

- **Duration:** 70min
- **Tasks:** 2/2
- **Commits:** 2 (`e180029c`, `ee201c3a`)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `test(02-03): add failing live-choice tests` (`e180029c`) | OK — `02-03-red.json` → `RED_EVIDENCE_OK` |
| GREEN | `feat(02-03): choose the live triples on one shelf` (`ee201c3a`) | OK — 51/51 class-switch unit tests |
| REFACTOR | — | Skipped (no cleanup commit needed) |

## Accomplishments

- Extended `attemptsForClass` with bench/tool/image/window filters, confirmed-aware sort, thin share, and credential expansion.
- Added `requestFacts`, `liftToolResultImages`, `remember`, `rememberedCredential`, and `setThinShareCounter` in `plan.ts`, re-exported through `seam.ts` with `classShelfActive`.
- Exported `benchSortSignals` for sort tie-breakers; added catalog test invalidation helper.
- Expanded `choice.test.mjs` with RED/GREEN cases while keeping plan 02-01 scenarios green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Empty credential providers must still serve shelf rows**
- **Found during:** Task 2 (GREEN)
- **Issue:** `hasLiveCredential` returned false when a provider had no `credentials` array, wiping valid shelf models.
- **Fix:** Treat zero-credentials providers as live when the model is not benched; emit one attempt per model.
- **Files modified:** `packages/core/src/class-switch/plan.ts`
- **Committed in:** `ee201c3a`

**2. [Rule 3 - Blocker] Sort keys need bench health export**
- **Found during:** Task 2 (GREEN)
- **Issue:** Confirmed/remainder/duration sort required data not exposed from `bench.ts`.
- **Fix:** Added `benchSortSignals` export.
- **Files modified:** `packages/core/src/class-switch/bench.ts`
- **Committed in:** `ee201c3a`

**3. [Rule 3 - Blocker] Unit catalog overrides in choice tests**
- **Found during:** Task 2 (GREEN)
- **Issue:** Stale in-memory model catalog caused tool/image filter tests to flake in full-suite runs.
- **Fix:** `invalidateModelCatalogIndexForTest` plus per-test catalog fixtures; reset in-memory bench before dependent tests.
- **Files modified:** `packages/core/src/gateway/model-catalog.ts`, `choice.test.mjs`
- **Committed in:** `ee201c3a`

**Total deviations:** 3 auto-fixed (Rule 2: 1, Rule 3: 2)

## Authentication Gates

None.

## Known Stubs

None for plan goal — executor one-credential wiring and step-down remain in plan 02-04.

## Threat Flags

None beyond plan threat model (`liftToolResultImages` copies body before mutating blocks).

## Self-Check: PASSED

- FOUND: `packages/core/src/class-switch/plan.ts`
- FOUND: `.planning/phases/02-live-choice/02-03-SUMMARY.md`
- FOUND commit: `e180029c`
- FOUND commit: `ee201c3a`
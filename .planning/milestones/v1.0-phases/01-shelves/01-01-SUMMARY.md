---
phase: 01-shelves
plan: 01
subsystem: api
tags: [class-switch, shelves, routing, tdd]
requires:
  - phase: none
    provides: baseline routing execution plan
provides:
  - class-switch catalog snapshot read/write and AA score helpers
  - parseClassRequest and attemptsForClass shelf resolution
  - applyShelf seam on createRouteExecutionPlan
affects: [01-shelves plan 02, plan 03, BACK-01 catalog walk]
tech-stack:
  added: []
  patterns:
    - Shelf snapshot file under resolveRuntimeDataDir cache
    - Parent imports seam.ts only for class open
key-files:
  created:
    - packages/core/src/class-switch/catalog.ts
    - packages/core/src/class-switch/plan.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/test/unit/class-switch/plan.test.mjs
  modified:
    - packages/core/src/routing/execution-plan.ts
key-decisions:
  - "Score helpers ship in the RED commit so the tracer test can assert 50.3375 before shelf open exists"
  - "Equal-score shelf order uses provider then model localeCompare; rows without scores are dropped from attempts"
patterns-established:
  - "Pattern: applyShelf at end of createRouteExecutionPlan with CCR_CLASS_SWITCH=0 short-circuit"
requirements-completed: [SHELF-01, SHELF-02]
coverage:
  - id: D1
    description: Class names open scored shelves through createRouteExecutionPlan
    requirement: SHELF-01
    verification:
      - kind: unit
        ref: packages/core/test/unit/class-switch/plan.test.mjs
        status: pass
    human_judgment: false
  - id: D2
    description: Artificial Analysis score formula and shelf row ordering
    requirement: SHELF-02
    verification:
      - kind: unit
        ref: packages/core/test/unit/class-switch/plan.test.mjs#claude-opus opens the scored opus shelf
        status: pass
    human_judgment: false
actuals:
  tokens: 12000
  tasks: 2
  commits: 4
plan_head_before: 3ce5ed7efd1a2715d86ad531953e3f646fd288f1
plan_head_after: f018f073
duration: 12min
completed: 2026-11-14
status: complete
---

# Phase 01 Plan 01: Class shelf open Summary

**Scored class shelves replace route attempts via `applyShelf` on `createRouteExecutionPlan`, with SHELF-01 parsing and SHELF-02 sort on disk snapshot rows.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-14T17:01:29Z
- **Completed:** 2026-11-14T17:13:00Z
- **Tasks:** 2
- **Files modified:** 5 source/test files

## Accomplishments

- Added `packages/core/src/class-switch/{catalog,plan,seam}.ts` and wired `createRouteExecutionPlan` to `applyShelf`.
- `claude-opus-4-6`, `best`, and the four `claude-*` families open the matching shelf when the snapshot resolves provider rows.
- `[1m]` filters, hex `anthropic/claude-ccr-h` route ids, kill switch `CCR_CLASS_SWITCH=0`, corrupt or empty snapshots, and equal-score ordering are covered in `plan.test.mjs`.

## Task Commits

1. **Task 1 (tracer): End-to-end claude-opus opens one scored shelf** — `b96975a3` (test), `2c9d1816` (feat)
2. **Task 2: Class-name edges, one-million filter, and kill switch** — `c7882cc3` (test), `f018f073` (feat)

## TDD Gate Compliance

| Gate | Evidence | Commit |
|------|----------|--------|
| RED (opus shelf) | `.planning/phases/01-shelves/01-01-red.json` — attempt model mismatch | `b96975a3` |
| GREEN (opus shelf) | `plan.test.mjs` tracer test pass | `2c9d1816` |
| RED (edges) | `.planning/phases/01-shelves/01-01-red-edges.json` — `best` not routed | `c7882cc3` |
| GREEN (edges) | all 9 tests pass | `f018f073` |

Note: `gsd_run check tdd-red-evidence` was not available in PATH; JSON evidence files were written manually per plan.

## Files Created/Modified

- `packages/core/src/class-switch/catalog.ts` — snapshot types, AA score, read/write cache file
- `packages/core/src/class-switch/plan.ts` — `parseClassRequest`, `attemptsForClass` with sort and 1m filter
- `packages/core/src/class-switch/seam.ts` — `applyShelf` kill switch and attempt replacement
- `packages/core/src/routing/execution-plan.ts` — return `applyShelf(plan, input)`
- `packages/core/test/unit/class-switch/plan.test.mjs` — nine unit tests for SHELF-01/02 on this path

## Decisions Made

- Kept score/`classifyModel` implementation in the first RED commit so the tracer fixture could assert `50.3375` before shelf routing existed (RED failure stayed on attempt model, not classify).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `esbuild` and `better-sqlite3` build**
- **Found during:** Task 1 verify
- **Issue:** `npm run test:unit` failed before tests compiled or ran
- **Fix:** Ran `npm install` and built `better-sqlite3` locally
- **Files modified:** none in repo (environment)
- **Commit:** n/a

**2. [Rule 2 - Missing functionality] Score helpers in RED commit**
- **Found during:** Task 1 RED
- **Issue:** Stub `classifyModel` made the tracer fail before attempt assertions
- **Fix:** Implemented `scoreArtificialAnalysis`, `classForScore`, and `classifyModel` in the RED commit; left `applyShelf` stubbed
- **Files modified:** `packages/core/src/class-switch/catalog.ts`
- **Commit:** `b96975a3`

## Deferred Issues

- Full `npm run test:unit -w @claude-code-router/core` still reports 3 unrelated pre-existing failures in web management tests (plugins migration). Class-switch and routing-architecture suites pass when run directly.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-shelves/01-01-SUMMARY.md`
- FOUND: `packages/core/src/class-switch/catalog.ts`
- FOUND: `b96975a3`, `2c9d1816`, `c7882cc3`, `f018f073` on `HEAD`
---
phase: 02-live-choice
plan: 01
subsystem: class-switch
tags: [bench, shelf, tdd, node-test]

requires:
  - phase: 01-shelves
    provides: shelf snapshot, attemptsForClass sort, applyShelf seam

provides:
  - In-memory 5xx bench with cache/class-switch-bench.json persist
  - Scalar bag on RouteExecutionPlanInput through createRouteExecutionPlan
  - choice.test.mjs proving park-then-next-model path

affects: [02-02, 02-03, 02-04]

actuals:
  tokens: 6600
  tasks: 2
  commits: 2
  plan_head_before: 2633b511c7b22d0e2cb10ac3ecc3621e7e7ea07b
  plan_head_after: 59fe3e1e

tech-stack:
  added: []
  patterns:
    - "Module-level bench map updated before async disk write"
    - "Provider+model bench key for class 5xx (30s)"

key-files:
  created:
    - packages/core/src/class-switch/bench.ts
    - packages/core/test/unit/class-switch/choice.test.mjs
  modified:
    - packages/core/src/class-switch/plan.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/src/routing/execution-plan.ts

key-decisions:
  - "Only HTTP 5xx writes a bench row in 02-01; 400/429 clocks wait for later plans"
  - "Scalar bag is accepted but not used for filtering in this plan"

patterns-established:
  - "recordClassRefusal re-exported from seam.ts only for parent imports"

requirements-completed: [CHOICE-01, SAFE-01]

coverage:
  - id: D1
    description: Class 5xx parks higher-score model; next shelf model becomes the attempt
    requirement: CHOICE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#a benched higher score yields the next live model"
        status: pass
    human_judgment: false
  - id: D2
    description: Fully parked shelf keeps parent attempt list (no step-down)
    requirement: CHOICE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#a fully parked opus shelf keeps the parent attempt"
        status: pass
    human_judgment: false
  - id: D3
    description: Scalar bag reaches policy without message body on the plan input type
    requirement: SAFE-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#a benched higher score yields the next live model"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 1: Park 5xx and Next Shelf Model Summary

**Class 5xx parks provider+model in memory (30s), filters shelf rows in `attemptsForClass`, and passes tool/image/token scalars through `createRouteExecutionPlan` without the message body.**

## Performance

- **Duration:** 25min
- **Tasks:** 2/2
- **Commits:** 2 (`46062e7d`, `59fe3e1e`)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `test(02-01): add failing test for a benched higher score` (`46062e7d`) | OK — `02-01-red.json` → `RED_EVIDENCE_OK` |
| GREEN | `feat(02-01): park a class 5xx and serve the next shelf model` (`59fe3e1e`) | OK — choice + plan class-switch tests green |
| REFACTOR | — | Skipped (no cleanup commit needed) |

## Accomplishments

- Added `bench.ts` with `recordClassRefusal` / `isBenched` for status ≥500 only; persists to `cache/class-switch-bench.json`.
- `attemptsForClass` drops benched rows; optional scalar bag type added (ignored for filtering in this plan).
- `applyShelf` and `createRouteExecutionPlan` thread `toolNames`, `hasImage`, `estimatedTokens`, `toolTurn`, `sessionId`.
- `choice.test.mjs` covers next-model selection, empty shelf parent fallback, 400 no-park, and `CCR_CLASS_SWITCH=0`.

## Deviations from Plan

### Scoped verification note

**Plan-level `npm run test:unit -w @claude-code-router/core`:** The full workspace suite exits 1 due to **three pre-existing** desktop-plugin failures (`known bundled plugins…`, `legacy combined Claude Design…`, `Claude Design runtime plugin…`). All `class-switch/plan.test.mjs` and `class-switch/choice.test.mjs` tests pass when run directly (13/13).

None - plan scope executed as written for class-switch files.

## Authentication Gates

None.

## Known Stubs

None for plan goal — 429/401/403/404 clocks, token-per-row repetition, and executor one-credential flow are explicitly deferred to plans 02-02 through 02-04.

## Threat Flags

None beyond plan threat model (scalar bag only; no body parameter added).

## Self-Check: PASSED

- FOUND: `packages/core/src/class-switch/bench.ts`
- FOUND: `packages/core/test/unit/class-switch/choice.test.mjs`
- FOUND: `.planning/phases/02-live-choice/02-01-SUMMARY.md`
- FOUND commit: `46062e7d`
- FOUND commit: `59fe3e1e`
---
phase: 01-shelves
plan: 03
subsystem: api
tags: [class-switch, context-window, catalog-walk, tdd]
requires:
  - phase: 01-shelves
    plan: 01
    provides: shelf snapshot IO and execution plan seam
  - phase: 01-shelves
    plan: 02
    provides: classifyModel and matchOpenRouterModel
provides:
  - Real context_window and max_context_window on GET /v1/models
  - Ten-minute shelf catalog walk without chat probes
  - seedShelvesFromConfig and refreshClassShelves snapshot maintenance
affects: [01-shelves phase 2, BACK-01 ops]
tech-stack:
  added: []
  patterns:
    - applyContextWindows after parent gateway models builders
    - Catalog walk beside provider auto-refresh, not merged
key-files:
  created:
    - packages/core/test/unit/class-switch/context-window.test.mjs
  modified:
    - packages/core/src/class-switch/catalog.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/src/gateway/features/model-discovery.ts
    - packages/core/src/web/management-server.ts
    - packages/core/test/unit/class-switch/classify.test.mjs
key-decisions:
  - "OpenRouter score GET retries once with an openrouter.ai provider key on HTTP 401"
  - "Thrown probes copy prior provider rows verbatim instead of re-classifying"
patterns-established:
  - "Pattern: contextWindowForProviderModel order metadata, catalog max, then OpenRouter lengths"
requirements-completed: [SHELF-01, BACK-01]
coverage:
  - id: D1
    description: Gateway models expose configured context_window without inventing 200000
    requirement: SHELF-01
    verification:
      - kind: unit
        ref: packages/core/test/unit/class-switch/context-window.test.mjs#gateway models expose a 272000 context window
        status: pass
    human_judgment: false
  - id: D2
    description: Catalog refresh classifies, drops missing ids, and keeps rows after probe failure
    requirement: BACK-01
    verification:
      - kind: unit
        ref: packages/core/test/unit/class-switch/classify.test.mjs#catalog refresh drops a missing model and keeps a failed provider
        status: pass
    human_judgment: false
actuals:
  tokens: 52000
  tasks: 2
  commits: 4
plan_head_before: 0d8ae222ada36bff106056bb58e1fb3ae1c08a14
plan_head_after: df9d885406b3edec6fd8fa3199842c441653352b
duration: 45min
completed: 2026-11-14
status: complete
---

# Phase 01 Plan 03: Context window and catalog walk Summary

**Real `context_window` on `/v1/models` plus a 10-minute `mode: models` shelf walk that seeds, classifies, and retains rows on probe failure.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-11-14T17:15:00Z
- **Completed:** 2026-11-14T18:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `contextWindowForProviderModel` and `applyContextWindows` so Claude and OpenAI gateway model lists publish real windows, including kill-switch bypass.
- Implemented `seedShelvesFromConfig`, `refreshClassShelves`, and timer start/stop with atomic snapshot writes and OpenRouter score fetch.
- Hooked `startClassSwitch` / `stopClassSwitch` into management server lifecycle beside existing provider auto-refresh.

## Task Commits

1. **Task 1 RED: Real context window on the models response** — `824fe764` (test)
2. **Task 1 GREEN** — `d3de78a3` (feat)
3. **Task 2 RED: Ten-minute catalog walk** — `732e835d` (test)
4. **Task 2 GREEN** — `df9d8854` (feat)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (context window) | `824fe764` | Pass |
| GREEN (context window) | `d3de78a3` | Pass |
| RED (catalog refresh) | `732e835d` | Pass |
| GREEN (catalog refresh) | `df9d8854` | Pass |

## Files Created/Modified

- `packages/core/test/unit/class-switch/context-window.test.mjs` — SHELF-01 gateway and chain tests
- `packages/core/src/class-switch/catalog.ts` — window chain, seed, refresh, timer
- `packages/core/src/class-switch/seam.ts` — `applyContextWindows`, `start`, `stop`
- `packages/core/src/gateway/features/model-discovery.ts` — single return through `applyContextWindows`
- `packages/core/src/web/management-server.ts` — lifecycle hooks
- `packages/core/test/unit/class-switch/classify.test.mjs` — BACK-01 refresh scenarios

## Decisions Made

None beyond plan — followed specified probe/score/snapshot rules.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — full class-switch and claude-app-gateway-models unit files pass locally. Three unrelated plugin permission tests still fail in the full core unit suite (pre-existing).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Shelves snapshot and `/v1/models` windows are ready for phase 2 filters and monitoring.

## Self-Check: PASSED

- FOUND: packages/core/test/unit/class-switch/context-window.test.mjs
- FOUND: .planning/phases/01-shelves/01-03-SUMMARY.md
- FOUND: 824fe764, d3de78a3, 732e835d, df9d8854

---
*Phase: 01-shelves*
*Completed: 2026-11-14*
---
phase: 02-live-choice
plan: 02
subsystem: class-switch
tags: [bench, tdd, rate-limit, probe, node-test]

requires:
  - phase: 02-live-choice
    provides: 5xx bench map, choice.test 5xx parking

provides:
  - Provider clock and quota parsing in bench.ts
  - recordClassSuccess, startBench/stopBench wired from seam.ts
  - bench.test.mjs covering BENCH-01, BENCH-02, BACK-02

affects: [02-03, 02-04]

actuals:
  tokens: 72000
  tasks: 2
  commits: 2
  plan_head_before: e26473c83717ad70b95f693f30fcb68b104a7896
  plan_head_after: 01465ebbb80c2e27a129b3be4f56c196985ebc7d

tech-stack:
  added: []
  patterns:
    - "Triple key provider\\0credential\\0model with * wildcards"
    - "30s bench probe timer separate from catalog walk"

key-files:
  created:
    - packages/core/test/unit/class-switch/bench.test.mjs
    - .planning/phases/02-live-choice/02-02-red.json
  modified:
    - packages/core/src/class-switch/bench.ts
    - packages/core/src/class-switch/seam.ts

key-decisions:
  - "429 with no parseable clock parks 60s and logs no-provider-time"
  - "403 without resets_at sets probe false and fix-key; no connectivity probe"
  - "Large remainder skip uses >10 requests or >10000 tokens inside paired reset window"

patterns-established:
  - "recordClassRefusal accepts optional credentialId, headers, and body JSON"
  - "startBench retains spawn config when loadConfig is absent (unit tests)"

requirements-completed: [BENCH-01, BENCH-02, BACK-02]

coverage:
  - id: D1
    description: Vendor clocks (Retry-After, X-RateLimit-Reset, JSON resets, Groq durations) park the correct triple scopes
    requirement: BENCH-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/bench.test.mjs#retry-after seconds park that credential on that model"
        status: pass
    human_judgment: false
  - id: D2
    description: Quota zero from remainder headers parks until paired Groq reset; no free-tier RPM export
    requirement: BENCH-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/bench.test.mjs#remaining requests zero uses paired Groq duration"
        status: pass
    human_judgment: false
  - id: D3
    description: Connectivity probe for shelf models with mode connectivity and models length 1
    requirement: BACK-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/bench.test.mjs#probe uses mode connectivity and one model"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 2: Provider clock, quota, probe Summary

**Class-switch bench rows now follow upstream clocks and quota headers; a separate connectivity timer probes one shelf model when due.**

## Performance

- **Duration:** 45min
- **Tasks:** 2/2
- **Commits:** 2 (`d4c3df03`, `01465ebb`)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `test(02-02): add failing bench clock tests` (`d4c3df03`) | OK — `02-02-red.json` → `RED_EVIDENCE_OK` |
| GREEN | `feat(02-02): park from the provider clock and probe one shelf model` (`01465ebb`) | OK — 23/23 `bench.test.mjs`; choice + plan class-switch green |
| REFACTOR | — | Skipped (no cleanup commit needed) |

## Accomplishments

- Extended `bench.ts` with clock parser order from RESEARCH Pattern 4, status scopes (429/401/403/404/5xx), quota-zero parks, and leg / fix-key logging without API keys.
- Added `recordClassSuccess`, connectivity probe timer (`startBench` / `stopBench`, 30s period), and test-only introspection helpers.
- Wired `seam.start` / `seam.stop` to the bench timer when `CCR_CLASS_SWITCH` is not `"0"`.
- Added `bench.test.mjs` (23 cases) for clocks, quota, probe skip/probe-false, and bad bench file load.

## Deviations from Plan

None - plan scope executed as written for bench, seam, and tests.

### Scoped verification note

Full `npm run test:unit -w @claude-code-router/core` may still exit non-zero due to pre-existing desktop-plugin failures noted in 02-01-SUMMARY. All `class-switch/bench.test.mjs`, `choice.test.mjs`, and `plan.test.mjs` tests pass when run directly (36/36 in this session).

## Authentication Gates

None.

## Known Stubs

None for plan goal — executor/pipeline class refusal wiring and plan sort filters remain in 02-03/02-04.

## Threat Flags

None beyond plan threat model (credential slug in logs and bench file only).

## Self-Check: PASSED

- FOUND: `packages/core/test/unit/class-switch/bench.test.mjs`
- FOUND: `packages/core/src/class-switch/bench.ts`
- FOUND: `.planning/phases/02-live-choice/02-02-SUMMARY.md`
- FOUND commit: `d4c3df03`
- FOUND commit: `01465ebb`
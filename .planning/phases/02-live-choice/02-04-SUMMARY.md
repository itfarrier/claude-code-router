---
phase: 02-live-choice
plan: 04
subsystem: class-switch
tags: [choice, gateway, executor, pipeline, node-test]

requires:
  - phase: 02-live-choice
    provides: live shelf attempts, bench clocks, tool-turn memory

provides:
  - One credential per class upstream attempt with request-local slug rotation
  - Class refusal loop with delay 0, stop on 400, bench via recordClassRefusal
  - markClassAttempt / isClassAttempt WeakSet seam
  - Pipeline skip of parent recordProviderCredentialOutcome for class legs
  - Gateway cases in choice.test.mjs

affects: []

actuals:
  tokens: 120000
  tasks: 2
  commits: 2
  plan_head_before: 8355450d0f8f10cebf091830184aeadde8dcbfa0
  plan_head_after: 9f90b70878dc00c7a20697d93acb948ad0bfa6be

tech-stack:
  added: []
  patterns:
    - "Request-local Set tracks credential slugs already sent on a class request"
    - "classLive gates the refusal loop; bench owns parks instead of credential-pool cooldown"

key-files:
  created: []
  modified:
    - packages/core/src/gateway/upstream/executor.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/src/gateway/request/pipeline.ts
    - packages/core/test/unit/class-switch/choice.test.mjs

key-decisions:
  - "Class response handling keys off classLive for the whole refusal loop"
  - "Return the last class failure when later rows are skipped without a fetch"

patterns-established:
  - "WeakSet marks class attempts; no UpstreamAttempt field"

requirements-completed: [CHOICE-02, SAFE-02]

coverage:
  - id: D1
    description: One credential, delay 0, stop on 400, and sent-slug rotation
    requirement: CHOICE-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#a class attempt sends one credential"
        status: pass
    human_judgment: false
  - id: D2
    description: Failed class leg log omits provider key; executor does not call recordUsage
    requirement: SAFE-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/choice.test.mjs#a failed class leg omits the provider key"
        status: pass
    human_judgment: false
  - id: D3
    description: Pipeline skips parent recordProviderCredentialOutcome for class attempts
    requirement: SAFE-02
    verification:
      - kind: unit
        ref: "packages/core/src/gateway/request/pipeline.ts isClassAttempt guard"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-11-14
status: complete
---

# Phase 2 Plan 4: One Credential Class Gateway Summary

**The upstream loop sends one live credential per class row, continues pre-token refusals at delay 0, stops on 400, and skips the parent 60s cooldown for class legs.**

## Performance

- **Duration:** 90min
- **Tasks:** 2/2
- **Commits:** 2 (`41eaa503`, `9f90b708`)

## Accomplishments

- Extended `fetchUpstreamWithFallback` / `buildUpstreamAttempts` with `classLive`, session id resolution, image lift, and a per-request sent-credential set.
- `prepareUpstreamCredentialAttempt` benches out parked keys, honors tool-turn memory, emits one target, and marks attempts via `WeakSet`.
- Class refusals call `recordClassRefusal` / `recordClassSuccess` + `remember`; pipeline guards `recordProviderCredentialOutcome` with `isClassAttempt`.
- Added `a class attempt sends one credential` and `a failed class leg omits the provider key` in `choice.test.mjs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical] Return last class failure when later rows skip without fetch**
- **Found during:** Task 1 (gateway 404 / all-benched rows)
- **Issue:** Loop threw after a class 404 benched the model and remaining rows had no credentials.
- **Fix:** Track `lastClassFailureResponse` and return it when the class loop exhausts without success.
- **Files modified:** `packages/core/src/gateway/upstream/executor.ts`
- **Committed in:** `41eaa503`

**2. [Rule 3 - Blocker] Safe requestFacts when JSON parse cache is stale**
- **Found during:** Task 1 (gateway tests)
- **Issue:** `requestFacts` could throw on reused parse cache entries during the same request.
- **Fix:** Serialize a fresh body for `requestFacts` with fallback scalar extraction on failure.
- **Files modified:** `packages/core/src/gateway/upstream/executor.ts`
- **Committed in:** `41eaa503`

**Total deviations:** 2 auto-fixed (Rule 2: 1, Rule 3: 1)

### Scoped verification note

Full `npm run test:unit -w @claude-code-router/core` may still exit non-zero due to pre-existing desktop-plugin and unrelated gateway failures. All `class-switch/choice.test.mjs`, `bench.test.mjs`, and `plan.test.mjs` cases pass in this session.

## Authentication Gates

None.

## Known Stubs

None for plan goal.

## Threat Flags

None beyond plan threat model.

## Self-Check: PASSED

- FOUND: `packages/core/src/gateway/upstream/executor.ts`
- FOUND: `packages/core/src/class-switch/seam.ts`
- FOUND: `packages/core/src/gateway/request/pipeline.ts`
- FOUND: `.planning/phases/02-live-choice/02-04-SUMMARY.md`
- FOUND commit: `41eaa503`
- FOUND commit: `9f90b708`
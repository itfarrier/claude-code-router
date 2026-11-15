---
phase: 03-step-down
plan: 01
subsystem: class-switch
tags: [step-down, notice, gateway, response-headers, node-test, tdd]

requires:
  - phase: 02-live-choice
    provides: live shelf attempts with bench clocks, class refusal loop with request-local sent set, applyShelf seam at createRouteExecutionPlan, classAttempt WeakSet marker

provides:
  - attemptsForStepDown ordered requested-to-lower-class planner with class-level hasLiveTripleForClass and shelfClassForTarget
  - One process-local SwapNotice record with actual-success recording, latest-swap replacement, and read-time live-again clearing
  - Parent-facing notice seam (getSwapNotice / recordStepDownSuccess / clearSwapNotice) with stop-time clearing
  - Shared SwapNoticeClass / SwapNotice contract in contracts/app.ts (no RequestLogEntry change)
  - Paired x-ccr-requested-model / x-ccr-served-model response headers set only on an actual lower-class 2xx, deleted on every other response
  - Core RED/GREEN evidence in packages/core/test/unit/class-switch/step-down.test.mjs and 03-01-red.json

affects: [03-step-down UI surfaces, management-server notice read, electron IPC bridge]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
  plan_head_before: e9f199650478687dc234e47d512f1d519a8421da
  plan_head_after: ebba9c96281232ae1d01a7876c0ee82adc4e1b52

tech-stack:
  added: []
  patterns:
    - "RouteModelRef object identity as the planner-to-executor shelf channel via WeakMap (no UpstreamAttempt field)"
    - "One thin-share decision consumed per planning call, applied within each nonempty class"
    - "Spoof removal then paired set for disclosure headers on the response-header collection point"

key-files:
  created:
    - packages/core/src/class-switch/notice.ts
    - packages/core/test/unit/class-switch/step-down.test.mjs
    - .planning/phases/03-step-down/03-01-red.json
  modified:
    - packages/core/src/class-switch/plan.ts
    - packages/core/src/class-switch/seam.ts
    - packages/core/src/contracts/app.ts
    - packages/core/src/gateway/request/pipeline.ts
    - packages/core/test/unit/class-switch/choice.test.mjs
    - packages/core/test/unit/class-switch/plan.test.mjs

key-decisions:
  - "Ordered append semantics: requested-class rows first, then every strictly lower class in fable-opus-sonnet-haiku order, so pre-token refusals fall through (FALL-03) and only full exhaustion errors"
  - "Recovery uses the class-level shelf/credential/bench predicate, never request-specific tool/image/[1m] capability"
  - "safeguardsApplies keys on the provider's own anthropic identity, not an anthropic_messages protocol borrowed by another provider"
  - "credentialLabel carries the executor credential slug (cred-sonnet), the colon of credential id cred:sonnet slugified"

patterns-established:
  - "WeakMap from RouteModelRef to ShelfClass avoids new fields on RouteAttemptPlan/UpstreamAttempt"
  - "Compiled-test request-log writer points at .test-dist runtime worker with a root after() closeRequestLogRuntime"

requirements-completed: [FALL-01, FALL-02, FALL-03]

coverage:
  - id: D1
    description: Empty requested shelf serves the next lower class through the existing executor with the Claude body identity preserved and paired disclosure headers
    requirement: FALL-01
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#an empty Opus shelf returns a Sonnet Claude success with one notice"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#requested-class priority beats every model below"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#each lower class serves in Fable then Opus then Sonnet then Haiku order"
        status: pass
    human_judgment: false
  - id: D2
    description: One current swap notice with requested/served class, model, provider, credential slug, reason, safeguards flag; clears when the requested class is live again
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#an actual step-down success records the reason safeguards and route fields"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#a recovered requested class clears the notice on read"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#the latest recorded swap is the single read result"
        status: pass
    human_judgment: false
  - id: D3
    description: Lower classes stay reachable after higher-class refusals; error only when all four classes are exhausted
    requirement: FALL-03
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#a requested refusal falls through to the lower-class success"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#an all-empty shelf set returns an empty attempt list and the terminal error"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#every row refusing keeps the last refusal without a lower-class success"
        status: pass
    human_judgment: false
  - id: D4
    description: Response-header spoof removal and secret-free notice/log disclosure on real swaps only
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#a same-class success sets no step-down headers even when the upstream supplies them"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#a non-class response drops upstream supplied step-down headers"
        status: pass
      - kind: unit
        ref: "packages/core/test/unit/class-switch/step-down.test.mjs#recorded notices never carry the credential secret or request text"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-15
status: complete
---

# Phase 3 Plan 1: Ordered step-down success and swap notice Summary

**An empty Opus shelf now serves a normal Claude success from Sonnet through the existing executor: the body keeps `claude-opus-4-6`, paired `x-ccr-requested-model`/`x-ccr-served-model` headers name the swap, and one process-local notice describes it until the requested class is live again.**

## Performance

- **Duration:** 45min (started 2026-11-15T08:56:19Z, completed 2026-11-15T09:41:31Z)
- **Started:** 2026-11-15T08:56:19Z
- **Completed:** 2026-11-15T09:41:31Z
- **Tasks:** 2/2 (RED then GREEN per TDD)
- **Files modified:** 8 (2 created source/test, 5 modified source, 2 modified test files, 1 evidence record)

## TDD Evidence

- **RED:** `.planning/phases/03-step-down/03-01-red.json` — `gsd_run check tdd-red-evidence` returned **RED_EVIDENCE_OK** (exit 1, 22 tests, 17 failing, target test `an empty Opus shelf returns a Sonnet Claude success with one notice` failed semantically on the served-route assertion: expected upstream body model `sonnet-live`, actual `claude-opus-4-6` — the phase-2 parent route still served the empty-shelf request through the provider stub).
- **GREEN:** `npm run test:unit -w @claude-code-router/core` — 1000 tests, **995 pass / 3 fail**, where the 3 failures are the known pre-existing `plugin-config-migration` (2) and `plugin-permissions` (1) failures explicitly out of scope. Class-switch directory: **130/130 pass**. `npm run test:architecture`: **5/5 pass**.
- **No live provider call:** every pipeline/executor test stubs `globalThis.fetch`; the all-empty cases prove zero upstream fetches.

## Accomplishments

- `attemptsForStepDown` builds one ordered list per request: the requested shelf first, then each strictly lower class in fable → opus → sonnet → haiku rank order, reusing the exact phase-2 filters (one-million window, bench, registry resolution, tools, images, context, live credentials, score/tie-break ordering) and consuming one thin-share decision per call.
- `notice.ts` keeps one process-local SwapNotice: actual lower-class successes record it (reason `no live {Class} triple` or `all {Class} attempts refused before first token`), the latest success replaces it, reads reconcile the saved requested class against the class-level liveness predicate and clear after recovery, and `seam.stop()` clears it.
- `pipeline.ts` deletes spoofed `x-ccr-requested-model`/`x-ccr-served-model` on every response and sets both together only after an actual lower-class 2xx, before every `writeHead` and log read; the response body keeps Claude's requested model.
- `contracts/app.ts` adds `SwapNoticeClass`/`SwapNotice` for core, Electron, and UI without touching `RequestLogEntry`; `hasLiveTripleForClass` gives the notice a class-level recovery predicate that never consumes the thin-share counter.
- Converted the phase-2 "fully parked shelf keeps the parent attempt" expectation to the deliberate phase-3 lower-class result and updated `plan.test.mjs` empty/corrupt-shelf expectations to `attempts: []`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer, RED): add failing step-down success and notice tests** - `9c15541f` (test)
2. **Task 2 (GREEN): implement ordered step-down success and swap notice** - `ebba9c96` (feat)

## Files Created/Modified

- `packages/core/src/class-switch/notice.ts` (created) - one process-local SwapNotice record, actual-success recording, replacement, read-time live-again reconciliation
- `packages/core/test/unit/class-switch/step-down.test.mjs` (created) - pipeline tracer plus executor, planner, and notice named cases (22 tests)
- `packages/core/src/class-switch/plan.ts` - factored `filteredShelfRows`; added `attemptsForStepDown`, `shelfClassForTarget`, `hasLiveTripleForClass`
- `packages/core/src/class-switch/seam.ts` - `applyShelf` uses `attemptsForStepDown` (`attempts: []` on full exhaustion); `stop()` clears the notice; parent-facing notice exports
- `packages/core/src/contracts/app.ts` - `SwapNoticeClass` and `SwapNotice` shared types
- `packages/core/src/gateway/request/pipeline.ts` - header spoof removal plus the record-and-set seam beside `clientVisibleResponseModel`
- `packages/core/test/unit/class-switch/choice.test.mjs` - parked-shelf case renamed and converted to the lower-class expectation
- `packages/core/test/unit/class-switch/plan.test.mjs` - opus[1m] two-row expectation and all-empty/corrupt `attempts: []`
- `.planning/phases/03-step-down/03-01-red.json` - persisted RED evidence record

## Decisions Made

- **Ordered append (not empty-only) step-down:** the plan's must-have wording ("no lower-class model appears in the attempt list" when the requested class is live) conflicts with its own named RED cases and FALL-03 ("a requested refusal followed by lower-class success", "terminal error only after all rows refuse"). Resolved to ordered append: requested rows first, lower rows after, the parent loop stops at the first success. This is the only reading under which both FALL-01 priority and FALL-03 refusal fall-through hold.
- **credentialLabel is the executor credential slug** (`cred-sonnet`), not the raw credential id (`cred:sonnet`): the plan's own GREEN action passes `upstreamResult.attempt.credentialIds?.[0]`, and the executor stores slugs (the colon is slugified). The notice contract "credential value is a slug or label" holds.
- **safeguardsApplies reads the provider's own identity** (`provider.provider ?? provider.type` normalized to the anthropic identity): an `anthropic_messages` protocol borrowed by a non-Anthropic preset stays false, as the plan requires.
- **Recovery predicate is class-level** (empty tools, no image, zero tokens, no one-million requirement, bench and credential liveness only), per the plan's locked reconciliation semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seam.ts stop() crashed with `clearSwapNotice is not defined`**
- **Found during:** Task 2 (bench.test.mjs `CCR_CLASS_SWITCH zero does not start the bench timer`)
- **Issue:** `export { clearSwapNotice } from ...` re-exports create no local binding, so the `stop()` call threw a ReferenceError.
- **Fix:** Added a real `import { clearSwapNotice }` beside the re-export.
- **Files modified:** `packages/core/src/class-switch/seam.ts`
- **Verification:** bench.test.mjs and the full class-switch directory pass (130/130)
- **Committed in:** `ebba9c96`

**2. [Rule 1 - Bug] Compiled test could not start the request-log writer worker**
- **Found during:** Task 2 (target test log-field assertions)
- **Issue:** The bundled request-log runtime resolved `request-log-worker.js` relative to the test bundle; the writer never started, so the logged swap fields were never written.
- **Fix:** Pointed `requestLogRuntime.options.workerFile` at the compiled runtime worker and added a root `after()` that closes the runtime so the test process exits (the established integration-suite pattern from `october-issues-wire.test.mjs`).
- **Files modified:** `packages/core/test/unit/class-switch/step-down.test.mjs`
- **Verification:** target test log assertions pass; the step-down file exits 0 in 736ms
- **Committed in:** `ebba9c96`

**3. [Rule 1 - Bug] Test-fixture corrections from runtime probing**
- **Found during:** Task 2
- **Issue:** Three test assumptions contradicted real executor/harness behavior: (a) the pipeline harness always makes one `__ccr/route` core-endpoint fetch, so the all-empty pipeline case cannot assert zero fetches; (b) the executor does not push the final refusal leg into `failedAttempts` because that leg's response is the returned one; (c) a 429 rotation writes a bench row, so a fresh sent-set proof needs a 402 (continues the class walk, writes no bench row).
- **Fix:** Asserted no fetch reaches `/v1/messages` in the all-empty pipeline case; expected `failedAttempts` 1 for the all-refuse case; switched the sent-set rotation leg to 402.
- **Files modified:** `packages/core/test/unit/class-switch/step-down.test.mjs`
- **Verification:** 22/22 step-down tests pass against real behavior
- **Committed in:** `ebba9c96`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 bug fixes — one production ReferenceError, two test-infrastructure/fixture corrections)
**Impact on plan:** All fixes were necessary for a green, non-hanging suite. No scope creep; executor.ts, credential-pool.ts, and catalog.ts untouched.

## RED Semantic Assessment

The RED failure was the deliberate phase-2 behavior, reached through the real pipeline: the GatewayRequestPipeline tracer compiled, the shelf/registry/credential fixtures loaded, the provider stub received the request, and the failure was the served-route assertion (upstream body model `claude-opus-4-6` from an empty Opus shelf) — exactly the behavior GREEN replaces. The 6 passing RED tests were cases whose phase-2 and phase-3 expectations coincide (kill-switch/non-class parent attempts, and stub notice reads that return null both before and after the stub period).

## Issues Encountered

- The full core unit suite needs a generous window (~10 min); the earlier 300s runs timed out mid-suite, not on a failure. Final run: exit 1 solely due to the 3 documented pre-existing failures.
- The compiled test path is `.test-dist/core/test/class-switch/step-down.test.js` (the `unit/` scope segment is dropped by the build), matching the plan's TAP command exactly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The notice seam (`getSwapNotice`) and shared `SwapNotice` type are ready for the management-server RPC, Electron IPC/preload, and the UI banner/pill surfaces (remaining Phase 3 plans).
- The UI contract's SD pill and expanded log detail derive from existing `RequestLogEntry` fields; the paired headers are already flowing into `responseHeaders`.
- No blockers: kill switch (`CCR_CLASS_SWITCH=0`), non-class requests, thin-share accounting, tool-turn stickiness, and credential-pool behavior are unchanged and covered by green tests.

---
*Phase: 03-step-down*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND: `packages/core/src/class-switch/notice.ts`
- FOUND: `packages/core/test/unit/class-switch/step-down.test.mjs`
- FOUND: `.planning/phases/03-step-down/03-01-red.json`
- FOUND: `.planning/phases/03-step-down/03-01-SUMMARY.md`
- FOUND commit: `9c15541f` (test(03-01): add failing step-down success and notice tests)
- FOUND commit: `ebba9c96` (feat(03-01): implement ordered step-down success and swap notice)
- RED evidence: RED_EVIDENCE_OK recorded in 03-01-red.json
- GREEN suite: 995/1000 core unit tests (3 known pre-existing failures out of scope), 130/130 class-switch, 5/5 architecture

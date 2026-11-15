---
phase: 01-shelves
reviewed: 2026-11-14T18:29:57Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - packages/core/src/class-switch/catalog.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/routing/execution-plan.ts
  - packages/core/src/gateway/features/model-discovery.ts
  - packages/core/src/web/management-server.ts
  - packages/core/test/unit/class-switch/plan.test.mjs
  - packages/core/test/unit/class-switch/classify.test.mjs
  - packages/core/test/unit/class-switch/context-window.test.mjs
  - packages/electron/src/main/main-app.ts
  - packages/electron/src/main/ipc.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
  necessity: 0
status: issues_found
---

# Phase 01-shelves: Code Review Report

**Reviewed:** 2026-11-14T18:29:57Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Re-review after commit `a933c3fb`. WR-07 is fixed. `runSerializedRefresh` keeps one `refreshClassShelves` in flight. `startClassSwitchCatalog` bumps `walkGeneration`, sets `refreshAgain`, and the seed `finally` schedules one delay-0 pass. That pass calls `loadConfig` again. The in-flight callback returns before `scheduleCatalogWalk` when its captured generation is behind, so it does not clear the pending delay-0 timer. `writeShelfSnapshot` is awaited inside the lock, so the older pass finishes before the later pass starts.

The test "config save during shelf refresh runs follow-up pass with newer snapshot" blocks the first probe, calls `startClassSwitchCatalog` again, and checks a second load of `"saved"` plus a snapshot that has `fresh-marker`.

WR-04 and IN-01 are still in the code. They stay open on purpose. They are accepted deferrals, not failed fixes. Necessity review was applied. No necessity finding.

The new waiter drops that later pass when the in-flight refresh rejects. That is WR-08.

Prior IDs fixed: CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-05, WR-06, WR-07. Prior IDs still open: WR-04, IN-01. New ID: WR-08.

Unit tests were read and not re-run.

## Warnings

### WR-08: A failed shelf refresh drops the follow-up the config save requested

**File:** `packages/core/src/class-switch/catalog.ts:846-851`
**Issue:** `runSerializedRefresh` sets `refreshAgain` and then awaits `refreshInFlight`. `startClassSwitchCatalog` bumps `walkGeneration` (`catalog.ts:897-899`), so the in-flight loop does not repeat (`catalog.ts:860`). The delay-0 callback is the waiter that must start the later pass. `await refreshInFlight` throws before the `refreshAgain` check when that pass rejects. `writeShelfSnapshot` sits outside the per-provider catch (`catalog.ts:828-829`), and `loadConfig()` can throw (`catalog.ts:859`). The schedule callback catches that error and, when this callback is the current generation, schedules the 10-minute interval (`catalog.ts:883-888`). A delay-0 callback that is already waiting during the probe then leaves the saved config off the shelf until that tick. A delay-0 callback that has not entered `runSerializedRefresh` yet still starts a fresh pass after the lock clears.
**Fix:** Catch the in-flight rejection in the waiter and still start the queued pass. The owner callback still awaits the original promise and logs the failure.

```ts
if (refreshInFlight) {
  refreshAgain = true;
  try {
    await refreshInFlight;
  } catch {
    // The failed pass must not drop a start that set refreshAgain.
  }
  if (refreshAgain && catalogWalkEnabled) {
    return runSerializedRefresh(options);
  }
  return;
}
```

### WR-04: A permitted class name can be sent to a model the profile did not allow

**File:** `packages/core/src/class-switch/plan.ts:124-134`
**Issue:** Still open. Deferred to phase 2. The parent request loop was not rewritten, and this review does not treat that as a failed fix. The profile check still runs on the requested model before the execution plan (`packages/core/src/gateway/request/pipeline.ts:431-433`). `isModelAllowedForProfile` treats `claude-opus-4-6` as allowed when that string, or the stripped seed `opus-4-6`, resolves to one allowlisted provider model. `attemptsForClass` then emits every resolved row on that shelf. `createRouteExecutionPlan` still has no profile argument (`execution-plan.ts:9-46`). `buildUpstreamAttempts` calls it with no profile (`packages/core/src/gateway/upstream/executor.ts:1093-1099`). A key limited to `Alpha/opus-4-6` can be sent to `Beta/gpt-5.6-sol` when that row sorts first on the opus shelf. `resolvePlannedProviderCredentialRoutingTarget` writes `attempt.target.model` into the upstream body, so the substitution is what the provider receives.
**Fix:** Leave this for phase 2. Do not rewrite the parent request loop in this phase. When that phase starts, pass the authenticated profile into `createRouteExecutionPlan` and drop a shelf row unless `isModelAllowedForProfile(config, profile, provider + "/" + model)` is true. If none remain, return `undefined` so the parent plan stays.

## Info

### IN-01: Snapshot window lookup is case-sensitive

**File:** `packages/core/src/class-switch/seam.ts:65`
**Issue:** Still open on purpose. The refresh stores the trimmed probe id (`catalog.ts:735`). Metadata lookup folds case (`seam.ts:46-49`). Snapshot lookup requires `row.model === model` and `row.provider === providerName`. A probe id `gpt-4o` does not fill the window for registry model `GPT-4o`, so the third source is skipped and the response keeps the builder value.
**Fix:** Compare provider and model with the same trim-and-lowercase match used for metadata keys. This was left open on purpose for this phase.

---

_Reviewed: 2026-11-14T18:29:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

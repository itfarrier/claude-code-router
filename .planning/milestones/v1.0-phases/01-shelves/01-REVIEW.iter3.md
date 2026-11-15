---
phase: 01-shelves
reviewed: 2026-11-14T18:02:35Z
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

**Reviewed:** 2026-11-14T18:02:35Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Re-review after the fix pass. The eight targeted fixes hold in the current source. A failed score GET keeps the previous shelf row and score, and a new id is classified with no indexes. Refresh passes `architecture.modality` and `architecture.output_modalities` into `classifyModel`. Desktop start, quit, and config save call `startClassSwitch` / `stopClassSwitch`. Each tick reloads config. Three tier tokens use the highest-versus-lowest distance. The window overlay updates `supported` and `supports_1m_context` when those objects exist. Invalid `excluded` and `review` rows are rejected. `classForScore` returns `ShelfClass` and the impossible branch is gone.

WR-04 and IN-01 are still in the code. They stay open on purpose. They are not failed fixes. Necessity review was applied. No necessity finding remains.

One new bug: a config save starts another walk while a refresh is still in flight. The older walk can clear the new timer or write its snapshot last.

Prior IDs fixed: CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-05, WR-06. Prior IDs still open: WR-04, IN-01. New ID: WR-07.

Unit tests were read and not re-run.

## Warnings

### WR-07: A config save during a shelf refresh keeps the older snapshot

**File:** `packages/core/src/class-switch/catalog.ts:830-861`
**Issue:** `startClassSwitchCatalog` always schedules a delay-0 walk (`catalog.ts:874-876`). Web save, desktop save, and desktop startup all call that (`management-server.ts:460`, `ipc.ts:361`, `main-app.ts:253`). The timer callback sets `catalogWalkTimer` to `undefined` before the refresh (`catalog.ts:835-837`), then loads config and probes. A save during that probe schedules a second delay-0 run. There is no in-flight lock, unlike `runProviderModelAutoRefreshNow`. Two `refreshClassShelves` calls can both read the old snapshot and both `writeShelfSnapshot`. The older write can finish last and replace the newer shelves. If the first callback reaches `scheduleCatalogWalk` while the save's delay-0 timer is still pending, `defaultCatalogSchedule` clears that timer (`catalog.ts:832-834` and `catalog.ts:859-861`) and the immediate refresh never runs. The pre-save snapshot then stays until the next 10-minute tick. A provider or context-window edit made during a refresh does not reach class routing until that later tick.
**Fix:** Run one refresh at a time. If `start` happens during that refresh, run one more pass that loads config again after the current pass. A stale callback must not clear the timer or write the snapshot after a newer pass has started.

```ts
let refreshInFlight: Promise<void> | undefined;
let refreshAgain = false;
let walkGeneration = 0;

async function runSerializedRefresh(options: ClassSwitchCatalogOptions): Promise<void> {
  if (refreshInFlight) {
    refreshAgain = true;
    return refreshInFlight;
  }
  const generation = walkGeneration;
  refreshInFlight = (async () => {
    do {
      refreshAgain = false;
      const loadConfig = options.loadConfig ?? loadAppConfig;
      await refreshClassShelves(await loadConfig(), options);
    } while (refreshAgain && catalogWalkEnabled && generation === walkGeneration);
  })().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}
```

Bump `walkGeneration` in `startClassSwitchCatalog` before the new schedule, and skip the trailing `scheduleCatalogWalk` when `generation !== walkGeneration`.

### WR-04: A permitted class name can be sent to a model the profile did not allow

**File:** `packages/core/src/class-switch/plan.ts:124-134`
**Issue:** Still open. Deferred to phase 2. The parent request loop was not rewritten, and this review does not treat that as a failed fix. The profile check still runs on the requested model before the execution plan (`packages/core/src/gateway/request/pipeline.ts:431-433`). `isModelAllowedForProfile` treats `claude-opus-4-6` as allowed when that string, or the stripped seed `opus-4-6`, resolves to one allowlisted provider model. `attemptsForClass` then emits every resolved row on that shelf. `createRouteExecutionPlan` still has no profile argument (`execution-plan.ts:9-46`). `buildUpstreamAttempts` calls it with no profile (`packages/core/src/gateway/upstream/executor.ts:1093-1099`). A key limited to `Alpha/opus-4-6` can be sent to `Beta/gpt-5.6-sol` when that row sorts first on the opus shelf. `resolvePlannedProviderCredentialRoutingTarget` writes `attempt.target.model` into the upstream body, so the substitution is what the provider receives.
**Fix:** Leave this for phase 2. Do not rewrite the parent request loop in this phase. When that phase starts, pass the authenticated profile into `createRouteExecutionPlan` and drop a shelf row unless `isModelAllowedForProfile(config, profile, provider + "/" + model)` is true. If none remain, return `undefined` so the parent plan stays.

## Info

### IN-01: Snapshot window lookup is case-sensitive

**File:** `packages/core/src/class-switch/seam.ts:65`
**Issue:** Still open on purpose. The refresh stores the probe id as returned (`catalog.ts:732`). Metadata lookup folds case (`seam.ts:46-49`). Snapshot lookup requires `row.model === model` and `row.provider === providerName`. A probe id `gpt-4o` does not fill the window for registry model `GPT-4o`, so the third source is skipped and the response keeps the builder value.
**Fix:** Compare provider and model with the same trim-and-lowercase match used for metadata keys. This was left open on purpose for this phase.

---

_Reviewed: 2026-11-14T18:02:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

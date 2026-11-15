---
phase: 02-live-choice
reviewed: 2026-11-15T00:44:03Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - packages/core/src/class-switch/bench.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/gateway/model-catalog.ts
  - packages/core/src/gateway/request/pipeline.ts
  - packages/core/src/gateway/upstream/executor.ts
  - packages/core/src/routing/execution-plan.ts
  - packages/core/test/unit/class-switch/bench.test.mjs
  - packages/core/test/unit/class-switch/choice.test.mjs
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
  necessity: 0
status: clean
---

# Phase 02: Code Review Report (iteration 3 — final pass)

**Reviewed:** 2026-11-15T00:44:03Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** clean

## Summary

Final `--auto` fix-loop pass. This re-review re-read all nine files at deep depth and verified the two iteration-2 fixes (commits `b11f731b`, `2ad8d65d`) end to end, including the exact key-derivation agreement between the probe tick and the executor and the error-masking analysis of the new `.catch(() => undefined)` swallow. All 11 iteration-1 fixes were re-confirmed at their current line positions (no regression found in either round). IN-01 (Info) remains open by fix scope and is carried forward unchanged.

### WR-06 (b11f731b) — verified end to end

- The tick now derives the fix-key slug exactly as every other bench consumer does: `providerCredentialSlug(providerCredentialRuntimeId(provider, credential))` with the index argument omitted (`bench.ts:731`), replacing the dead `credential.credentialId?.trim() || "cred:0"` read.
- **Tick-side vs writer-side key agreement is exact.** `providerCredentialRuntimeId` defaults its index to `provider.credentials?.indexOf(credential)` (`runtime-topology.ts:346-350`), which is precisely the `providerIndex` the executor's writer side passes (`executor.ts:1338`, `providerIndex = provider.credentials?.indexOf(credential) ?? index`, consumed at `executor.ts:1344` for `selectProviderCredentials` and at `executor.ts:926-927` for the class-live filter). `activeProviderCredentials` returns the same object references from `provider.credentials` (`runtime-topology.ts:100-103`), so `indexOf` resolves identically on both sides. The only theoretical divergence — `provider.credentials` absent — is unreachable on the tick side: `activeProviderCredentials` then returns `[]` and the tick bails at `bench.ts:721-723` before deriving any slug. Provider and model key parts match too: `providerForName` enforces `providerRow.provider === provider.name.trim()`, and 403 fix-key rows are stored under model `*` on both sides (`bench.ts:401/406`, `bench.ts:732`).
- **Fixtures are production-shaped.** Every tick test now builds credentials as `{ id: "cred-x", enabled, api_key }` — the real `ProviderCredentialConfig` field set (`contracts/app.ts` id/name/label) — instead of the fictional `credentialId` property, and saved rows use the slugified real slug (`cred-x`, matching `providerCredentialSlug`). The new test "a saved fix-key row under the credential's real slug suppresses the probe" (`bench.test.mjs:583-621`) runs past the due mark and genuinely distinguishes fixed from unfixed: with the old `"cred:0"` slug the lookup would miss and the probe would fire (probeCalls 1), with the fix it stays off (probeCalls 0).
- The fix removed its own defect's type error: the previous `tsc` TS2339 at `bench.ts:720` is gone; `npx tsc --noEmit` now reports 14 errors, all matching the pre-existing baseline under consistent line shifts (`bench.ts:251→255`, `754→765`; `executor.ts:917→924`, `1476→1483`, `1483→1490`) — zero new errors.

### WR-07 (2ad8d65d) — verified end to end

- Both production call sites carry the guard: `recordClassSuccess(...).catch(() => undefined)` (`executor.ts:569-574`) and `recordClassRefusal(...).catch(() => undefined)` (`executor.ts:660-667`). A repo-wide grep confirms these are the only production call sites; `seam.ts:197` merely re-exports.
- **The swallow cannot mask a real logic error elsewhere.** Argument evaluation before the `.catch` cannot throw (plain property reads on `response.headers`, `attempt.credentialIds`); a throw there would bypass the catch and surface in the executor's catch block — but `Headers.entries()` and optional chaining on an already-prepared attempt cannot throw. The leg bookkeeping after the record call — `discardLastClassFailure()`, trace capture, `failedAttempts` push, and the return — runs unconditionally and does not consult the record result, so a swallowed disk error changes nothing about the leg. The executor's catch block (phantom network-error leg, body leak) is only reachable from the fetch/parse path, and the record promise now never rejects, so it can never reclassify the leg. Residual masking is confined to the bench module itself: a systematic programming error inside `recordClassRefusal`/`recordClassSuccess` would silently stop bench persistence — but those functions are exercised directly by the 105-test class-switch suite (parsing, row storage, snapshot writes, tick behavior), so such a bug fails CI. The swallow is scoped exactly to the side-channel disk failures it was prescribed for.
- **Both new tests genuinely exercise the fixed path.** "a bench-file write failure keeps the refusal body readable" (`choice.test.mjs:1143-1182`) poisons the bench snapshot path (file path made a directory → `rename` EISDIR inside `writeBenchSnapshot`) and asserts the 429 is returned with a readable body and `failedAttempts` deep-equal `[]` — without the `.catch`, the throw would surface as an `UpstreamRequestError` and the test would fail. "a bench-file write failure keeps a succeeded 2xx response" (`choice.test.mjs:1184-1218`) makes the same disk failure on a 2xx and asserts the response is kept and no retry fires.

### Regression and gate checks

- No regression in the locked boundaries: `UpstreamAttempt` (`gateway/internal/shared.ts:182-192`) gained no field; phase commits touched only `bench.ts`, `plan.ts`, `executor.ts` among source files — `credential-pool.ts`, `runtime-topology.ts`, `catalog.ts`, `seam.ts`, `pipeline.ts`, `model-catalog.ts`, `execution-plan.ts` are untouched since the phase base. The kill-switch paths (`CCR_CLASS_SWITCH=0` in `bench.ts:766/783`, `seam.ts:137/185/217/225`) are intact and covered by tests.
- The new `runtime-topology` import in `bench.ts` introduces no cycle: `runtime-topology.ts`, `model-registry.ts`, and `config.ts` hold no class-switch references — the graph remains one-directional (executor/seam/plan → bench → runtime-topology).
- Local gates at HEAD: core suite 1225 pass / 3 fail — the 3 failures are exactly the documented pre-existing `plugin-config-migration` / `plugin-permissions` ones (out of scope); every class-switch and gateway test passes. `npx tsc --noEmit`: 14 errors, all the pre-existing baseline (see WR-06 above for the shift mapping), none on any line the fix commits changed.
- Phase goal re-check: the strongest live triple is planned (`attemptsForClass` filters bench/tool/image/context and orders by score/confirm/remainder), a pre-token refusal continues to the next triple (statuses 401/402/403/404/408/409/429/5xx; 400 stops with its body readable), parks and clocks are recorded per credential+model with the tick and the executor agreeing on every bench key.

All reviewed files meet quality standards. No blocking or warning-tier issues found.

## Info

### IN-01: The 400 check in the continue helper never runs (carried from iteration 1)

**File:** `packages/core/src/gateway/upstream/executor.ts:1425-1427`
**Issue:** Unchanged and untouched by any fix round: `classShouldContinueAfterStatus` returns false for 400, but the class branch already returned on 400 at `executor.ts:608` before that call, so the helper's 400 branch is dead. Behavior-neutral (the statuses that follow do not include 400). Skipped as out of the `critical_warning` fix scope in every round; carried here so it is not lost.
**Fix:** Delete the 400 branch in `classShouldContinueAfterStatus`.

---

_Reviewed: 2026-11-15T00:44:03Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 3 (final pass of the --auto fix loop; fix commits 0704923d..950de82a, b11f731b, 2ad8d65d)_

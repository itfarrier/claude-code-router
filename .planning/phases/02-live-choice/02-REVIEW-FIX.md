---
phase: 02-live-choice
fixed_at: 2026-11-15T02:55:00Z
review_path: .planning/phases/02-live-choice/02-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 1
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-11-15T02:55:00Z
**Source review:** `.planning/phases/02-live-choice/02-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 2 (WR-06, WR-07; `fix_scope: critical_warning`)
- Fixed: 2
- Skipped: 1 (IN-01 — out of scope by fix scope, carried forward unchanged)

Both fixes were applied in an isolated worktree (`.claude/worktrees/rf-02-98913-1794701448`, branch `gsd-reviewfix/02-98913`, created from `auto-class-switch` at `950de82a`) and committed atomically, one commit per finding. Files touched: `packages/core/src/class-switch/bench.ts`, `packages/core/src/gateway/upstream/executor.ts`, plus tests in `packages/core/test/unit/class-switch/bench.test.mjs` and `packages/core/test/unit/class-switch/choice.test.mjs`. No new source files were created. The locked boundaries were respected: `credential-pool.ts`, `profiles/service.ts`, `config.ts`, `catalog.ts`, and `execution-plan.ts` were not touched, and the executor edits stay inside the existing class-switch paths (the two bench-record call sites and their comments). The iteration-1 findings (CR-01..CR-06, WR-01..WR-05) were verified sound by the iteration-2 review and were not re-touched.

## Verification

Where the gates ran: **inside the isolated worktree**. The worktree has no `node_modules` of its own; dependencies resolved through normal directory ascent to the main checkout's `node_modules` (the worktree is nested under the main repo directory). No symlink was created and the main checkout's dependency tree was not modified.

- Full unit suite `npm run test:unit -w @claude-code-router/core` at the fix tip: **978 tests — 973 pass, 3 fail, 2 skipped**. The 3 failures are the same pre-existing failures recorded in the run instructions (plugin-config-migration / plugin-permissions: "known bundled plugins without persisted permissions receive scoped defaults", "legacy combined Claude Design plugin config migrates to split Design and Ship plugins", "Claude Design runtime plugin config resolves from the bundled plugin in CCR Desktop without persisting") — identical test names to the pre-fix baseline; only their ordinals shifted because 3 new tests were added. Pre-fix baseline in the same worktree: 975 tests, 971 pass (this excludes the 2 WR-07 tests, which did not exist yet), same 3 failures.
- One flake note, unrelated to the fixes and not touched: in one full-suite run, "config save during shelf refresh runs follow-up pass with newer snapshot" (`classify.test.mjs`) failed with `ENOTEMPTY` raised by the test helper's own temp-dir cleanup (`withShelfTempDir` → `rmSync`). It passed on re-run in the full suite and in a direct single-file run. Timing race in the test helper's cleanup, not a regression.
- **Distinction proofs** (each new test flips exactly when the fix is reverted; compiled test files run directly from the repo root):
  - WR-06: with the guard temporarily reverted to the old line (`const slug = credential.credentialId?.trim() || "cred:0";`, source patched and rebuilt), the new bench test "a saved fix-key row under the credential's real slug suppresses the probe" FAILS (the probe fires because the slug is always "cred:0" and the lookup misses the real row) while all 26 prior bench tests pass. With the fix restored and rebuilt: 27/27.
  - WR-07: with both `.catch(() => undefined)` suffixes temporarily removed (old state, rebuilt), the two new choice tests FAIL — "a bench-file write failure keeps the refusal body readable" rejects with the bench disk error wrapped in `UpstreamRequestError` (the leg was mislabeled and the stored refusal body leaked), and "a bench-file write failure keeps a succeeded 2xx response" rejects the same way (the succeeded response was discarded) — while all 28 prior choice tests pass. With the fix restored and rebuilt: 30/30.
- `npx tsc --noEmit -p packages/core/tsconfig.json`: the WR-06 error `bench.ts(720,29): error TS2339` is **gone**. The remaining `bench.ts` errors are the two pre-existing unused-parameter errors (now at 255 and 765 — the same declarations the iteration-2 review listed at 251 and 754, shifted by the added import and comment lines). The remaining `upstream/executor.ts` errors map one-for-one to the pre-existing baseline (120-127, and 917/1476/1483 now shifted +7 to 924/1483/1490 by the two added comment lines). Zero new TypeScript errors.
- Class-switch suites at the fix tip: all green (30 in `choice.test.mjs`, 27 in `bench.test.mjs`, plus classify/context-window/plan).

Note: the suites above ran in the worktree environment; after the fast-forward they are reproducible from the main checkout at the branch tip.

## Fixed Issues

### WR-06: WR-05's fix-key probe suppression reads a property production configs never carry

**Files modified:** `packages/core/src/class-switch/bench.ts`, `packages/core/test/unit/class-switch/bench.test.mjs`
**Commit:** b11f731b
**Applied fix:** The probe tick's fix-key guard now derives the slug exactly the way every other bench consumer does:

```ts
const slug = providerCredentialSlug(providerCredentialRuntimeId(provider, credential));
```

(`bench.ts`, in `runBenchProbeTick`; the module's `runtime-topology` import was extended with `providerCredentialRuntimeId` and `providerCredentialSlug`.) Two derivation details were verified against the writer side before applying:

- Omitting the index argument matters. `providerCredentialRuntimeId` then resolves the **configured** index via `provider.credentials.indexOf(credential)` (`runtime-topology.ts:346-350`), which is the same value the executor's `selectProviderCredentials` uses (`executor.ts:1330-1337`: `providerIndex = provider.credentials?.indexOf(credential)`). The tick's credential comes from `activeProviderCredentials(provider)`, whose filtered array skips disabled and keyless credentials, so its own array index is **not** the configured one — the same trap documented at `plan.ts:151-156`.
- Writer/reader agreement: a 403 fix-key row is stored by the executor under `providerCredentialSlug(providerCredentialRuntimeId(provider, credential, providerIndex))` — the identical string this guard now resolves. (The old code read `credential.credentialId`, a property `ProviderCredentialConfig` does not have — `contracts/app.ts:256-268` — and which `parseProviderCredentials` never emits, so the slug was always `"cred:0"` and the guard could never match a real row.)

`bench.test.mjs` changes:

- Fixed the tick-test fixtures to production credential shapes: every tick test's credential object now uses `id:` (what `parseProviderCredentials` emits) instead of the invented `credentialId:` key, and the directly written bench-row keys were aligned with those credentials' real slugs (`cred:x` → `cred-x`, `cred:old`/`cred:new` → `cred-old`/`cred-new`, `cred:n`/`cred:o`/`cred:s` → `cred-n`/`cred-o`/`cred-s`), so the fixtures now match what production can actually store.
- Added the distinguishing test "a saved fix-key row under the credential's real slug suppresses the probe": the config credential uses `{ id: "cred-fix", api_key: "sk" }`, a saved row `BenchProvider\0cred-fix\0*` = `{ probe: false }` is loaded from disk, the shelf due mark is set at `FIXED_NOW`, and the tick runs at `FIXED_NOW + 130_000` (past the due mark, so the iteration-1 due-mark deferral cannot mask the guard). The test asserts no probe fires. Under the old guard the slug is always `"cred:0"`, the lookup misses the real-slug row, and the probe fires — the test fails (distinction proof above).

### WR-07: A bench-record throw between fetch and store leaks the refusal response the new lifecycle was meant to keep

**Files modified:** `packages/core/src/gateway/upstream/executor.ts`, `packages/core/test/unit/class-switch/choice.test.mjs`
**Commit:** 2ad8d65d
**Applied fix:** Made both bench-record call sites non-fatal, per the review's suggested shape:

- `recordClassSuccess` (2xx path): `.catch(() => undefined)` — a disk write failure inside the record call must not discard the already-succeeded response or retry the request on the next credential.
- `recordClassRefusal` (bench-row refusal path): `.catch(() => undefined)` — the surrounding `catch` block has no reference to the fetched response, so a record throw there could neither return nor cancel the body (leak) and would mislabel the leg as a network error with a phantom trace entry. Each call carries a short comment stating the bench is a side channel.

`choice.test.mjs` changes — two tests inject a bench-file failure deterministically by pre-creating `cache/class-switch-bench.json` as a **directory** (the snapshot's `rename` onto a directory fails; the shelf snapshot file next to it is untouched so planning still works), with a single credential and a single shelf row so the refusal leg is the last leg:

- "a bench-file write failure keeps the refusal body readable": upstream returns 429 with a JSON body; asserts the request still resolves with status 429, the readable body, and empty `failedAttempts`. Old behavior (distinction proof above): the record throw reached the network-error catch block, recorded a phantom leg, and threw `UpstreamRequestError` — the body was leaked.
- "a bench-file write failure keeps a succeeded 2xx response": upstream returns 200; asserts status 200 and empty `failedAttempts`. Old behavior: the succeeded response was discarded and the request rejected with the disk error.

Both tests clean up the poisoned path before the shared `resetGatewayBench()` teardown runs.

## Skipped Issues

### IN-01: The 400 check in the continue helper never runs (carried from iteration 1)

**File:** `packages/core/src/gateway/upstream/executor.ts:1418-1420`
**Reason:** Out of scope — `fix_scope: critical_warning` excludes Info findings (same disposition as iteration 1). No edit applied.
**Original issue:** `classShouldContinueAfterStatus` returns false for 400, but the class branch already returned on 400 at executor.ts:605 before that call, so the helper's 400 branch is dead. Behavior-neutral (the statuses that follow do not include 400).

---

_Fixed: 2026-11-15T02:55:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_

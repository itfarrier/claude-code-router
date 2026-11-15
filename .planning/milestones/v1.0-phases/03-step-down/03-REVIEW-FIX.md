---
phase: 03-step-down
fixed_at: 2026-11-15T12:15:23Z
review_path: .planning/phases/03-step-down/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-15T12:15:23Z
**Source review:** `.planning/phases/03-step-down/03-REVIEW.md`
**Iteration:** 1
**Scope:** critical_warning (CR-01…CR-05, WR-01…WR-05)

**Summary:**
- Findings in scope: 10
- Fixed: 10
- Skipped: 0 (in-scope); 1 out-of-scope info finding recorded below (IN-01)

## Session Note: Interrupted-Dispatch Recovery

This dispatch was told the previous fix dispatch "was lost before doing any work." That was not accurate, and the discrepancy materially changed the execution:

- A recovery sentinel (`03-REVIEW.md`'s phase dir) pointed at an orphan worktree `.claude/worktrees/rf-03-17488-1794741687` on temp branch `gsd-reviewfix/03-17488` carrying **9 complete, atomic fix commits** (all in-scope findings except CR-05) plus uncommitted CR-05 work in progress. Following the naive recovery path (`git branch -D`) would have destroyed that work, so this dispatch **adopted** the orphan state instead of restarting: reviewed every commit diff, re-ran the full core unit gate against the adopted state, and audited the CR-05 WIP (a coherent, well-tested runtime-channel implementation).
- Before this dispatch could commit the CR-05 WIP, the prior dispatch's process — evidently still alive — completed it: it committed `13542a5a` (CR-05), fast-forwarded `auto-class-switch` to the final state, removed the worktree, deleted the temp branch, and dropped the sentinel. All 10 fix commits now live on `auto-class-switch` (the main checkout).
- This dispatch therefore finished by verifying the **final merged state in the main checkout** (all four gates green; see Verification) and writing this report. The prior dispatch did not write a REVIEW-FIX.md, so this report documents the complete per-finding resolution with the actual commit hashes.
- This dispatch created no worktree, branch, or sentinel of its own; nothing of this session remains to clean up (the temp worktree this session ran verification in was removed by the prior dispatch's own cleanup).

## Fixed Issues

### CR-01: An asynchronous notice read can erase a newer swap or return stale state

**Files modified:** `packages/core/src/class-switch/notice.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`
**Commit:** `1aae6177`
**Status:** fixed: requires human verification
**Applied fix:** `readSwapNotice()` now captures the record, awaits the config/registry read, and only applies the captured record's own recovery decision when `currentSwapNotice === record`; a replacement that arrived during the await is returned untouched for its own reconciliation instead of being cleared or judged by the stale record's class. Regression added: an Opus swap recorded during a pending read must survive when a Fable swap replaces the singleton mid-read (`a swap recorded during the notice read survives the older swap's recovery`).

### CR-02: Tool-turn stickiness labels a lower-class target as the requested class

**Files modified:** `packages/core/src/class-switch/plan.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`
**Commit:** `eacadcf2`
**Status:** fixed: requires human verification
**Applied fix:** The sticky tool-turn branch of `attemptsForStepDown()` now derives the remembered target's shelf from the current snapshot via the shared `shelfClassInSnapshot()` helper (the same mapping the normal planner path uses) and stores that shelf in `targetShelfByReference` — never `parsed.shelfClass`; an unfindable target invents no class. Two-request regression added: Opus request served by Sonnet with a session id, then a tool-result-only turn — the second response still produces both `x-ccr-*` headers and the Opus→Sonnet notice (`a tool turn served by the remembered triple keeps the step-down notice`).

### CR-03: The kill switch still strips upstream headers

**Files modified:** `packages/core/src/gateway/request/pipeline.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`
**Commit:** `745e2222`
**Status:** fixed: requires human verification
**Applied fix:** All phase-added response-path header manipulation and notice recording are gated on `const classSwitchEnabled = process.env.CCR_CLASS_SWITCH !== "0"`: the paired-header deletion and the `recordStepDownSuccessFromTarget(...)` + paired-header writes both sit behind the gate. With `CCR_CLASS_SWITCH=0`, upstream-supplied `x-ccr-requested-model`/`x-ccr-served-model` are forwarded exactly as parent behavior does, and nothing is added. Regression added with the switch off and both headers supplied upstream (`the kill switch keeps upstream supplied step-down headers untouched`).

### CR-04: Log safeguards are inferred from a display name, not provider identity

**Files modified:** `packages/ui/src/pages/home/App.tsx`, `packages/ui/src/pages/home/components/network-logs.tsx`, `packages/ui/test/component/observability.test.tsx`
**Commit:** `6fbbf233`
**Status:** fixed: requires human verification
**Applied fix:** `stepDownDetailsForLog()` resolves the request-log provider display name back to its `GatewayProviderConfig` (passed through `App.tsx` → `LogsView` → log rows → `LogExpandedDetails` as a `providers` prop — no request-log schema change) and applies the shared core predicate `safeguardsAppliesForProvider()`; the display-name text never decides the safeguards fact. The predicate lives in the new `packages/core/src/class-switch/provider-identity.ts` so banner and log semantics cannot drift (identity = the provider's own `provider` field, falling back to explicit `type` only when absent). Fixtures: `AnthropicShim` (name≠identity, provider `anthropic`) must NOT show the warning; borrowed `anthropic_messages` protocol on a non-Anthropic provider must show it (negative control preserved); unresolved display name stays conservative.

### CR-05: Externally managed gateways cannot surface their swap notice in the management UI

**Files modified:** `packages/core/src/class-switch/notice-runtime.ts` (new), `packages/core/test/unit/class-switch/notice-runtime.test.mjs` (new), `packages/core/src/gateway/application/gateway-service.ts`, `packages/core/src/gateway/core-runtime/config-compiler.ts`, `packages/core/src/gateway/core-runtime/supervisor.ts`, `packages/core/src/web/management-server.ts`, `packages/core/test/unit/web/web-management-server.test.mjs`, `packages/electron/src/main/ipc.ts`, `build/esbuild.config.mjs`, `build/test.mjs`
**Commit:** `13542a5a`
**Status:** fixed: requires human verification
**Applied fix:** The executing runtime is the notice source of truth in adopted mode. A new fork-owned runtime plugin (`notice-runtime.ts`, compiled next to the router plugin with the same candidate layout) serves one authenticated GET route `/__ccr/runtime/swap-notice` (`auth: "gateway"`, reusing the runtime's static API key auth) that reads the executing runtime's own record through the real seam, with class-level reconciliation — polling the route also clears the record when the class is live again. The managing process's `gatewayService.readSwapNotice()` proxies to that channel when `gatewayManagedExternally` and mirrors the external record into the local projection (`recordSwapNotice`/`clearSwapNotice`), with a 1200 ms timeout and fall-back-to-local on an unusable channel. Both the web RPC (`management-server.ts`) and Electron IPC (`ipc.ts`) route through `gatewayService.readSwapNotice()`. The payload stays the scalar-only `SwapNotice` (validated by `isSwapNotice` before mirroring); no provider config, credential secret, request body, or error text crosses the channel in either direction. The plugin and route are kill-switch gated. Integration test added: an adopted runtime's real step-down (real planner + real notice seam) reaches the local UI's `getSwapNotice()` and subsequently reconciles to `null` when the runtime's record clears (`an adopted runtime's swap notice reaches the local UI and reconciles`), plus unit coverage for the plugin's kill-switch/config gating, the route contract, and the managing-side mirror/fallback behavior.

### WR-01: Any lower-class failure is misreported as failure of the requested class

**Files modified:** `packages/core/src/class-switch/plan.ts`, `packages/core/src/class-switch/seam.ts`, `packages/core/src/gateway/request/pipeline.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`
**Commit:** `8f0c9d1d`
**Status:** fixed: requires human verification
**Applied fix:** Replaced the global `upstreamResult.failedAttempts.length > 0` with the request-scoped `hasRequestedClassFailure(failedAttempts, requestedModel)`: a failed attempt counts toward the requested-class phrase only when its provider/model pair (parsed from the attempt's selector — never error text or message bodies) is a row of the requested shelf in the current snapshot. Regressions: no Opus rows with Sonnet responses `[429, 200]` keeps the reason `no live Opus triple`; a real Opus refusal then Sonnet success keeps `all Opus attempts refused before first token`.

### WR-02: Expanded log Reason selects an unrelated fallback decision

**Files modified:** `packages/ui/src/pages/home/components/network-logs.tsx`, `packages/ui/test/component/observability.test.tsx`
**Commit:** `831e5059`
**Status:** fixed
**Applied fix:** The expanded-log Reason now selects only a decision hop explicitly marked `source === "class-switch"` (scanned newest-first), never an arbitrary last nonempty reason; with no marked decision the Reason is omitted per the partial-data contract. Regression uses a production-shaped trace carrying a subsequent `fallback.execution-plan` hop (`fallback:model-chain`) and asserts its text never becomes the step-down Reason.

### WR-03: Ordinary model-chain fallbacks are falsely marked as class-switch swaps

**Files modified:** `packages/ui/src/pages/home/components/network-logs.tsx`, `packages/ui/test/component/observability.test.tsx`
**Commit:** `0a59df32`
**Status:** fixed
**Applied fix:** SD surfaces require the paired `x-ccr-requested-model`/`x-ccr-served-model` response headers as authenticity evidence before rendering (core emits them only for an actual recorded swap); missing or contradictory evidence suppresses both the pill and the detail block. The two class names still derive from `requestedModel`/`resolvedModel`, never from the header values. Regression: a parent `model-chain` Opus→Sonnet response with no paired headers renders no SD surfaces; contradictory evidence (headers present, served not lower-class) renders nothing too.

### WR-04: Encoded Claude App class requests never receive log SD surfaces

**Files modified:** `packages/ui/src/pages/home/components/network-logs.tsx`, `packages/ui/test/component/observability.test.tsx`
**Commit:** `2e7a28da`
**Status:** fixed
**Applied fix:** The UI decodes the requested route id before class matching (`decodeStepDownRouteId`, a renderer-local replica of core's `decodeClaudeAppGatewayRouteId` — same regex `^anthropic\/claude-ccr(?:\d+)?-h([0-9a-f]+)$`, same `[1m]` tolerance, same hex→UTF-8 decode — pinned by fixtures because the core module is not part of the renderer bundle), then applies the class parser to the decoded value. Fixtures cover `anthropic/claude-ccr-h${hex}`, `anthropic/claude-ccr7-h${hex}`, and `[1m]` variants, all producing the same SD output as the literal model id.

### WR-05: Secret-bearing provider configuration crosses the notice boundary despite the scalar-only contract

**Files modified:** `packages/core/src/class-switch/notice.ts`, `packages/core/src/class-switch/provider-identity.ts` (new), `packages/core/src/class-switch/seam.ts`, `packages/core/src/gateway/request/pipeline.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`
**Commit:** `75e027fd`
**Status:** fixed
**Applied fix:** `StepDownSuccessInput` is now scalars-only (`requestedModel`, `servedClass`, `model`, `provider`, `providerIdentity`, `credentialLabel`, `hadRequestedClassFailure`). The pipeline calls the new seam function `recordStepDownSuccessFromTarget({ target, ... })`, which derives every scalar in process memory — served shelf class via the shared snapshot mapping, model, provider display name, and the provider's Anthropic identity via `providerIdentityName()` — before crossing the notice boundary; the provider config object (and its credential secrets) never enters the notice module. The call precedes every response.writeHead path and log read. Tests: a scalars-only input carrying distinctive secrets cannot match the secret in the notice input or output; the Anthropic identity scalar alone decides `safeguardsApplies`.

## Out-of-Scope Findings (recorded per instruction)

### IN-01 (INFO): `servedModel` is a dead, potentially divergent input

**File:** `packages/core/src/class-switch/notice.ts`
**Status:** skipped — out of scope (info-tier finding outside `critical_warning` scope), largely subsumed: the WR-05 scalar DTO (`75e027fd`) rebuilt `StepDownSuccessInput` from scratch and the rebuilt shape no longer contains `servedModel` at all; `servedModel` was removed from the seam, the pipeline call site, and all tests. No separate action was taken beyond that side effect.

## Verification

All gates ran **in the main checkout** at the final merged state (`auto-class-switch` @ `13542a5afeff8b6a55145b20be067c1618ccf9ef`), except where noted:

- `npm run test:unit -w @claude-code-router/core` — **pass** (1012 tests, 0 failures on the final run; includes all class-switch, notice-runtime, and web-management regressions). Two earlier runs in the (now-removed) recovery worktree showed intermittent failures in `config/config-concurrency.test.mjs` and `observability/raw-trace-sync.test.mjs`; both are environmental flakes, evidenced below.
- `npm run test:component -w @claude-code-router/ui` — **pass** (131 tests, 0 failures). First attempt failed to build with `Could not resolve "@musistudio/lucide-morph-react"` in files untouched by any fix commit (`morph-icon.ts`, `layout.tsx`, `controls.tsx`); the dependency is declared in `packages/ui/package.json` and the lockfile but was missing from the main checkout's stale `node_modules`. Restored with a plain `npm install --prefer-offline` (no manifest or lockfile change; `git status` on those files is clean apart from a pre-existing uncommitted `allowScripts` line in the root `package.json` that predates this phase). The gate then passed.
- `npm run test:unit -w @claude-code-router/electron` — **pass** (45/45, includes `swap-notice-ipc.test.mjs`).
- `npm run test:architecture` — **pass**.

Flake evidence (pre-existing, not introduced by these fixes):

- `raw trace ACK measures only the newly admitted bundle after startup indexing` flaked **at pre-fix HEAD** under the electron runtime in the main checkout (1 failure in 10 standalone runs of that file), and again once in a full-suite run after the fixes; it did not recur on the final full run. Timing-sensitive test, independent of the phase's changes.
- `stale settings and unversioned RPC snapshots cannot overwrite another writer` (in `packages/core/test/unit/config/` — the family the phase orchestrator flagged as known-intermittent and out of scope) flaked only in the recovery-worktree runs (electron runtime, shared per-run temp home, parallel test files) and never in the main checkout's node-runtime runs, including the final green run.
- The recovery worktree's `better-sqlite3` native module was not built by `npm ci` (npm 12 script-approval gates; the committed manifest lacks the `allowScripts` entry that exists only as an uncommitted local change), so that environment ran the core suite under its electron fallback — the same machinery `build/run-tests.mjs` provides.

## Constraints Honored

- `packages/core/models.json` untouched — `git diff 01c647a1..HEAD -- packages/core/models.json` is empty and no fix commit touches it.
- Response body keeps Claude's requested model — no fix touches the response-body model path.
- Policy never receives the message body — no policy input was added.
- `safeguards` never invented — the notice and log state the fact derived solely from provider identity (`provider-identity.ts`), with negative-control tests for borrowed protocols and unresolved names.
- No API keys in logs/UI/notice — the notice boundary is scalars-only (WR-05) and the adopted-runtime channel carries only the validated scalar `SwapNotice` payload in either direction.
- `CCR_CLASS_SWITCH=0` keeps EXACT parent behavior — CR-03 gates all phase-added response-header manipulation and notice recording; the regression asserts upstream-supplied headers survive untouched.
- FORK-SEAMS boundaries — class-switch logic lives in `packages/core/src/class-switch/`; parent files (`pipeline.ts`, `executor.ts` paths, `management-server.ts`, `ipc.ts`) are touched only through seam functions (`seam.ts`, `notice-runtime.ts`, `gatewayService.readSwapNotice()`).
- Scalars-only notice input — WR-05 DTO plus the `isSwapNotice`-validated adopted-channel payload.

---

_Fixed: 2026-11-15T12:15:23Z_
_Fixer: the agent (gsd-code-fixer), with recovered work from the interrupted prior dispatch_
_Iteration: 1_

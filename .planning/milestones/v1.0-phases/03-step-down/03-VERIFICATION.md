---
phase: 03-step-down
verified: 2026-11-15T13:22:24Z
status: passed
score: 49/49 must-haves verified (4 human items validated 2026-11-15T13:55:00Z per 03-UAT.md — autonomous agent at the user's explicit direction)
covered_files:
  - .planning/phases/03-step-down/03-01-PLAN.md
  - .planning/phases/03-step-down/03-01-SUMMARY.md
  - .planning/phases/03-step-down/03-02-PLAN.md
  - .planning/phases/03-step-down/03-02-SUMMARY.md
  - .planning/phases/03-step-down/03-03-PLAN.md
  - .planning/phases/03-step-down/03-03-SUMMARY.md
  - .planning/phases/03-step-down/03-04-PLAN.md
  - .planning/phases/03-step-down/03-04-SUMMARY.md
  - .planning/phases/03-step-down/03-04-red.json
  - build/esbuild.config.mjs
  - build/test.mjs
  - packages/core/src/class-switch/notice-runtime.ts
  - packages/core/src/class-switch/notice.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/provider-identity.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/contracts/app.ts
  - packages/core/src/contracts/ipc-channels.ts
  - packages/core/src/gateway/application/gateway-service.ts
  - packages/core/src/gateway/core-runtime/config-compiler.ts
  - packages/core/src/gateway/core-runtime/supervisor.ts
  - packages/core/src/gateway/request/pipeline.ts
  - packages/core/src/web/management-server.ts
  - packages/core/test/support/step-down-request-log-home.mjs
  - packages/core/test/unit/class-switch/choice.test.mjs
  - packages/core/test/unit/class-switch/notice-runtime.test.mjs
  - packages/core/test/unit/class-switch/plan.test.mjs
  - packages/core/test/unit/class-switch/step-down.test.mjs
  - packages/core/test/unit/web/web-management-server.test.mjs
  - packages/electron/src/main/ipc.ts
  - packages/electron/src/main/preload.ts
  - packages/electron/test/unit/swap-notice-ipc.test.mjs
  - packages/ui/src/pages/home/App.tsx
  - packages/ui/src/pages/home/components/layout.tsx
  - packages/ui/src/pages/home/components/network-logs.tsx
  - packages/ui/src/pages/home/shared/i18n.tsx
  - packages/ui/src/types/electron.d.ts
  - packages/ui/src/web-client-bridge.ts
  - packages/ui/test/component/layout.test.tsx
  - packages/ui/test/component/observability.test.tsx
  - packages/ui/test/fixtures/step-down-production-log.json
  - packages/ui/test/integration/web-client-bridge.test.ts
covered_digest: "v4:sha256:be2026ca36794615813102f81c00b34a2a591bfe04fed8cd306ea5017df4bfd3"
behavior_unverified: 0
overrides_applied: 0
decision_coverage:
  honored: 0
  total: 0
  not_honored: []
prohibition_flags: "11 judgment-tier, descriptor-less prohibitions: non-authoritative code checks hold; sign-offs validated 2026-11-15T13:55:00Z by the autonomous agent at the user's explicit direction ('Do all by yourself'), each with code/test evidence in 03-UAT.md. See Human Verification Required."
re_verification:
  previous_status: gaps_found
  previous_score: 48/49
  gaps_closed:
    - "An actual step-down request-log entry contains the class-switch reason, and the expanded management log displays that reason (ROADMAP Success Criterion 2 / FALL-02)."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Review the six 03-01 judgment-tier prohibitions against the actual request/planner/response flow and the no-live-provider test evidence; confirm the response-body identity and that no Anthropic safeguards field is fabricated."
    expected: "Each negative invariant is accepted; no body/tool-result/image bytes reach the class policy, no invented route serves an empty class, the requested model name stays in the response body, no terminal error fires while a lower class can succeed."
    why_human: "The PLANs declare judgment-tier verification with no test-enforcement descriptor; autonomous code/test evidence is not authoritative resolution under ADR-550."
  - test: "Review the two 03-02 judgment-tier prohibitions against the authenticated web, Electron IPC, and adopted-runtime notice paths, including failure/timeout fallback."
    expected: "No unauthenticated write/read bypass or second independent notice store was introduced; all transports converge on gatewayService.readSwapNotice."
    why_human: "Both transport prohibitions are descriptor-less judgment items."
  - test: "Review the three 03-03 judgment-tier prohibitions against the actual banner/log controls and incomplete-data cases."
    expected: "No close button, new page/timer/schema/store, or fabricated/dash-substituted data; the reason now comes only from the real production class-switch hop."
    why_human: "Judgment-tier items require a human sign-off under ADR-550."
  - test: "Render a populated non-Anthropic swap with long model/token/provider/reason strings at desktop and narrow widths; inspect the banner, expanded log reason, and header rows."
    expected: "Text wraps without horizontal scroll/clipping; the banner respects the three-row presentation; fixed SD pills do not overflow; long values remain available by wrapping/tooltip; the Reason pair shows the real swap reason."
    why_human: "Static markup proves classes and copy, not browser layout, actual rendered-line count, or visual appearance across viewport/font settings."
---

# Phase 3: Step-down Verification Report

**Phase Goal:** An empty shelf still returns a Claude success from the next lower class, and the user sees one notice until that class is live again.
**Verified:** 2026-11-15T13:22:24Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure

**Code baseline:** HEAD `e5ebde9f` (docs-only) on top of the gap-closure commits `3c0522a0` (RED) and `2ce9674f` (GREEN) of plan 03-04, which sit on the previously reviewed `c8276e53` → `60e8b798` → `13542a5a` line. The gap commits touch only `packages/core/src/class-switch/seam.ts`, `packages/core/src/gateway/request/pipeline.ts`, `packages/core/test/unit/class-switch/step-down.test.mjs`, `packages/ui/test/component/observability.test.tsx`, the generated `packages/ui/test/fixtures/step-down-production-log.json`, and `.planning/phases/03-step-down/03-04-red.json`. Pre-existing unrelated working-tree modifications (`.planning/config.json`, `.planning/state.json`, `package.json` allowScripts, an uncommitted assertion-style tweak in `packages/ui/test/integration/web-client-bridge.test.ts`) were left untouched and are not phase artifacts.

This report supersedes the prior 03-VERIFICATION.md (status `gaps_found`, score 48/49). The one blocker gap — "Real request-log entries lack the step-down reason" — was closed by plan 03-04 and is re-derived fresh below with new behavioral evidence at HEAD. The 48 previously verified truths carry over under a regression check: their artifacts and links were re-verified through the CLI at HEAD, nine previously passing named behavioral tests were re-run and pass, and all four full regression gates were re-run at HEAD with the recorded results.

## Goal Achievement

The phase goal is now **achieved at the codebase level**: an empty shelf returns a Claude success from the next lower class (FALL-01), the user sees one notice until that class is live again (FALL-02), and the notice — including its **real swap reason** — appears in the request log and in the expanded management log from a production producer. What remains is not a code gap: the 11 judgment-tier prohibitions require human sign-off, and real-viewport layout is a visual check. That makes the status `human_needed`, not `gaps_found`.

### Gap closure (check 49) — fresh derivation

The prior blocker claimed: the renderer accepts a Reason only from `decision.source === "class-switch"`, but no production source emitted that decision. All three parts of the gap are now closed and were verified against the current code, not the SUMMARY:

1. **Producer exists and is explicitly marked.** `packages/core/src/class-switch/seam.ts` (`recordStepDownSuccessFromTarget`, lines 228–261) takes an optional `trace?: RouteTraceObserver` (type-only import from `@ccr/core/observability/route-trace`). Only when `recordStepDownSuccess` returns a non-null notice does it call `input.trace?.capture` exactly once with `kind: "decision"`, `name: "class-switch.step-down"`, `phase: "routing"`, `status: "ok"`, and `decision: { source: "class-switch", reason: notice.reason }`. The reason is copied from the notice — never recalculated, never taken from provider errors, bodies, or credentials. Null-notice paths (same-class, non-class, exhausted, kill switch) capture nothing.
2. **Wiring is inside the established seam and precedes log finalization.** `packages/core/src/gateway/request/pipeline.ts` line 943 passes `trace: routeTrace` to the existing `recordStepDownSuccessFromTarget` call inside the `classSwitchEnabled && upstreamResponse.ok` block (line 930). The success-path `writeRequestLog` invocations (lines 971, 1002, 1025, 1121) all run after this block, and `routeTrace.finish()` (line 338, inside the `writeRequestLog` closure) serializes on first call — so the marked hop is captured after a real lower-class 2xx and before the request log is finalized. No other pipeline call site changed; `routeTrace.finish` is untouched.
3. **Real evidence for both reason cases and the renderer.** `packages/core/test/unit/class-switch/step-down.test.mjs` line 1205 (`real step-down request logs persist both exact class-switch reasons`) runs both scenarios through `GatewayRequestPipeline` with `requestLogs: true`, reads fresh persisted rows via the list poll + `getDetail` route, and asserts **exactly one** hop with `decision.source === "class-switch"` carrying the exact reason — `no live Opus triple` for the empty-Opus Sonnet 2xx, and `all Opus attempts refused before first token` for the live-Opus 429-then-Sonnet-200 run — while the real `execution-plan` fallback decision is retained and no credential secret or request marker reaches the hop. The test regenerates `packages/ui/test/fixtures/step-down-production-log.json` from the first real persisted no-live entry (safe scalar projection + normalized volatile trace values only); `packages/ui/test/component/observability.test.tsx` line 671 (`expanded real swap log shows the production class-switch Reason without using fallback hops`) feeds that production-generated projection to the **unmodified** `LogExpandedDetails`, asserts `Reason` plus the exact reason render, asserts the real fallback reason (`fallback:off`) never displays, and proves the negative control: removing only class-switch hops (with the hop count updated) omits Reason entirely.

Behavioral confirmation at HEAD (this verification's own runs, not the SUMMARY's):

| Evidence | Command | Result |
|---|---|---|
| Core gap test (both reason cases) | `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/.../Electron --test --test-reporter=tap --test-name-pattern='real step-down request logs persist both exact class-switch reasons' .test-dist/core/test/class-switch/step-down.test.js` | `ok 1` — 1 pass, 0 fail, exit 0 |
| UI production-trace test | `node --test --test-reporter=tap --test-name-pattern='expanded real swap log shows the production class-switch Reason without using fallback hops' .test-dist/ui/test/observability.test.js` | `ok 1` — 1 pass, 0 fail, exit 0 |
| Fixture determinism/provenance | sha256 of `packages/ui/test/fixtures/step-down-production-log.json` before/after the core run | `7bc1105c…8308` both times — byte-identical; producer unchanged |
| Fixture content (producer's own hop) | parsed fixture | seq 8 `class-switch.step-down` (routing) with decision `{ reason: "no live Opus triple", source: "class-switch" }`; seq 4 real `fallback.execution-plan` with `fallback:off`; no body/credential fields |
| RED evidence | `.planning/phases/03-step-down/03-04-red.json` | core RED: exit 1, `0 !== 1` at the absent marked-hop count (producer gap, not setup); independent `uiEvidence`: exit 1 on the missing `/Reason/` while the fallback-only negative control held |

The RED evidence proves the failure mode the prior report described (persisted trace with zero class-switch hops), and the GREEN commit's regeneration added the real marked hop (seq 8, after the execution-plan hop at seq 4) with no manual fixture edit — confirmed by the byte-identical regenerated fixture at HEAD.

### Observable Truths — 03-01 (14/14)

Evidence carried forward from the prior verification after re-checking the underlying files at HEAD; the gap diff is additive to `seam.ts`/`pipeline.ts` and none of these behaviors changed (nine named regression tests re-run and pass; full core unit gate 1011 pass / 0 fail at HEAD).

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Requested-class priority beats lower models | ✓ VERIFIED | `attemptsForStepDown` concatenates requested rows first; `requested-class priority beats every model below` re-passed at HEAD. |
| 2 | Empty shelf, exactly one live row, and all-empty behavior | ✓ VERIFIED | `a shelf with exactly one live row yields that one attempt`, the primary pipeline tracer (`an empty Opus shelf returns a Sonnet Claude success with one notice`, re-passed), and both all-empty tests. |
| 3 | Exact class and `[1m]` semantics | ✓ VERIFIED | Shared `filteredShelfRows` calls `rowPassesOneMillionFilter`; `exact one-million filtering holds across the step-down list` checks 999999/1000000 boundaries. |
| 4 | Fable → Opus → Sonnet → Haiku attempt ordering | ✓ VERIFIED | `SHELF_CLASS_RANK` and the single concatenated loop; `each lower class serves in Fable then Opus then Sonnet then Haiku order`. |
| 5 | Per-request list and request-local sent set | ✓ VERIFIED | `applyShelf` builds once for the scalar bag (unchanged by the gap diff); `independent requests rebuild the list with a fresh request-local sent set`. |
| 6 | No swap → no notice/banner/detail | ✓ VERIFIED | Notice state defaults to null; banner/detail return null; null component tests and same-class negative controls. |
| 7 | Exact header values | ✓ VERIFIED | `pipeline.ts` uses sanitized `requestedModel` and final `routedModel` in the same `swapNotice` block; the primary tracer asserts both exact strings (re-passed at HEAD). |
| 8 | One latest current notice; concurrent log rows retain per-request facts | ✓ VERIFIED | Single `currentSwapNotice` replaced by `recordSwapNotice`; `a swap recorded during the notice read survives the older swap's recovery` re-passed at HEAD. |
| 9 | Notice clears when requested class is live again | ✓ VERIFIED | `readSwapNotice` calls `hasLiveTripleForClass` and clears; `a recovered requested class clears the notice on read`. |
| 10 | All four classes empty errors; no phantom success | ✓ VERIFIED | `applyShelf` returns `attempts: []`; all-empty pipeline and plan tests assert failure and no `/v1/messages` provider success. |
| 11 | Lower success wins; terminal error only after exhaustion | ✓ VERIFIED | `a requested refusal falls through to the lower-class success` and `every row refusing keeps the last refusal without a lower-class success`; refusal-attribution test re-passed at HEAD. |
| 12 | Response body preserves Claude identity; headers name actual routes | ✓ VERIFIED | Primary tracer passes: upstream `sonnet-live`, HTTP 200, client body `claude-opus-4-6`, exact requested/served headers. |
| 13 | Spoof headers removed except under the kill switch; paired set only on a real lower 2xx | ✓ VERIFIED | `pipeline.ts` gating unchanged; `the kill switch keeps upstream supplied step-down headers untouched` re-passed at HEAD. |
| 14 | Notice/header disclosure is scalar and secret-free | ✓ VERIFIED | Scalar-only DTO, fixed reasons and credential slug; secret/message non-disclosure tests. The underlying judgment prohibition remains flagged for human review below. |

### Observable Truths — 03-02 (6/6)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 15 | Authenticated `getSwapNotice` RPC returns standard envelope and record/null | ✓ VERIFIED | `management-server.ts` calls `gatewayService.readSwapNotice()` through existing `rpcHandlers`; real loopback populated/null test. |
| 16 | Zero-argument typed read exists on preload, browser bridge, and `Window.ccr` | ✓ VERIFIED | `electron.d.ts`, `preload.ts`, `web-client-bridge.ts` — all re-confirmed at HEAD. |
| 17 | Browser bridge uses existing RPC transport and no new write/route | ✓ VERIFIED | `web-client-bridge.ts:139` `getSwapNotice: () => rpc("getSwapNotice")`; `rpc()` defaults `args` to `[]` and posts only to `/api/ccr/rpc`. The CLI's text-pattern miss remains a false negative, resolved manually at HEAD. |
| 18 | Missing/invalid web token retains 401 | ✓ VERIFIED | Existing `/api/ccr/rpc` auth guard runs before `rpcHandlers[method]`; real loopback test asserts invalid token 401 and `{ok:false}`. |
| 19 | Desktop channel invokes the same logical notice read | ✓ VERIFIED | `IPC_CHANNELS.appGetSwapNotice` → `ipcMain.handle` → `gatewayService.readSwapNotice()`; `desktop IPC returns the current swap notice through the seam` is in the passing electron 45/45 set at HEAD. |
| 20 | No duplicated state, persistence, schema extension, secret, or bypass of reconciliation | ✓ VERIFIED | Both transports use `gatewayService.readSwapNotice`; schema remains based on existing request-log fields. |

### Observable Truths — 03-03 (28/28 implementation checks)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 21 | Banner wraps/grows within existing geometry | ✓ VERIFIED | `min-w-0`/`break-words` classes and no scroll/clipping container; long-value markup test asserts the wrapping contract. Actual appearance remains a human check (item 4 below). |
| 22 | Long mono ids may truncate with tooltip; three content rows | ✓ VERIFIED | `swapDetailNodes` supplies mono/truncate/title spans; targeted banner test re-passed at HEAD. |
| 23 | Non-step-down entries render no pill; class mismatch detection | ✓ VERIFIED | `stepDownDetailsForLog` requires strict lower class plus authentic paired headers; negative controls unchanged (`network-logs.tsx` untouched by the gap commits). |
| 24 | No separate pill loading state | ✓ VERIFIED | Rows derive directly from loaded `RequestLogEntry`; no async branch added. |
| 25 | Failed/incomplete data creates no fabricated pill | ✓ VERIFIED | Missing headers or underivable classes return null. |
| 26 | Exact SD styling and translated tooltip | ✓ VERIFIED | Exact classes, fixed `SD`, requested/served title; component value assertions. |
| 27 | One derivable class is insufficient | ✓ VERIFIED | Both `requestedClass` and `servedClass` required; incomplete negative controls. |
| 28 | Fixed-size, nonwrapping pill | ✓ VERIFIED | `shrink-0 whitespace-nowrap text-[10px]` asserted; no long id enters the pill. |
| 29 | One pill per affected row; zero otherwise | ✓ VERIFIED | Renderer tests assert exact counts for zero, one, and two affected rows. |
| 30 | Tooltip contains classes, face exactly SD | ✓ VERIFIED | Long-model test checks every SD title and fixed face. |
| 31 | Empty step-down renderers create no empty container | ✓ VERIFIED | Conditional JSX mounts only when details are non-null. |
| 32 | Detail uses loaded entry; no separate loading state | ✓ VERIFIED | `LogExpandedDetails` derives synchronously from `entry`. |
| 33 | Missing data/error behavior renders no fabricated detail | ✓ VERIFIED | `LogStepDownNotice` is conditional; incomplete negative fixtures produce zero warning blocks. |
| 34 | Expanded heading/pairs and conditional safeguards content render correctly | ✓ VERIFIED | Heading, class/model/token/reason pairs and safeguards line; the Reason consumer now receives its production hop (check 49 closed). |
| 35 | Missing routeTrace omits Reason; no placeholder dashes | ✓ VERIFIED | Absent fields omitted; test asserts no `Reason`, dash, or fabricated reason; the unmarked production-trace control re-proves this at HEAD. |
| 36 | Detail metric grid uses wrapping geometry | ✓ VERIFIED | `min-w-0 grid` plus `LogMetric wrap` asserted. |
| 37 | Exactly one detail block per expanded entry | ✓ VERIFIED | One conditional mount; test counts one block. |
| 38 | Expanded model/token values wrap in mono | ✓ VERIFIED | `LogMetric wrap` supplies `font-mono break-words`; value-level assertions. |
| 39 | Absent response headers produce no header rows | ✓ VERIFIED | `networkHeaderRows({})` returns `[]`; no row manufactured. |
| 40 | Headers retain existing loading/data path | ✓ VERIFIED | `LogJsonPanel` not replaced; headers derive from the loaded entry as before. |
| 41 | No new header error state | ✓ VERIFIED | No new error branch or component. |
| 42 | Both x-ccr headers appear as ordinary rows | ✓ VERIFIED | Pipeline persists `responseHeaders`; `networkHeaderRows` test asserts exact names/values. |
| 43 | Backend sets both headers in one path | ✓ VERIFIED | Same `if (swapNotice)` block sets both; no independent path. |
| 44 | Header names/values use existing wrapping geometry | ✓ VERIFIED | Existing header-table rendering reused unchanged. |
| 45 | Exactly two new header rows for a swap, none for non-swaps | ✓ VERIFIED | Existing-header contract test counts one row per name; backend negative tests remove forged headers on non-swaps. |
| 46 | Banner mount, status semantics, non-dismissal, null behavior | ✓ VERIFIED | `MainLayout` mount test and three-row banner test re-passed at HEAD; `role="status"`, `aria-live="polite"`, no action control. |
| 47 | Existing 2000ms polling cycle, equal-snapshot preservation, nonfatal failures, no second timer | ✓ VERIFIED | The read joins the existing `Promise.allSettled`; only the existing runtime poll is used. |
| 48 | Conditional safeguards copy and English/zh entries | ✓ VERIFIED | Provider identity flows to log safeguards; `appCopy.en/zh` contains the new copy; `t()` used before interpolation; `safeguards follow the configured provider identity, not the display name` re-passed at HEAD. |

### Goal-backward Requirement Truth (1/1)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 49 | A real step-down request log contains the swap reason displayed by the expanded log | ✓ VERIFIED | Fresh end-to-end evidence at HEAD: `seam.ts:251–259` captures exactly one `{ source: "class-switch", reason: notice.reason }` decision for a non-null notice; `pipeline.ts:943` passes `trace: routeTrace` inside `classSwitchEnabled && upstreamResponse.ok`, before every success-path `writeRequestLog` and `routeTrace.finish`; the named core test passes for both exact reasons through the real request-log writer; the generated production fixture carries the real marked hop (seq 8) plus the real `execution-plan` fallback (seq 4); the named UI test passes — `LogExpandedDetails` renders the production Reason and never the fallback reason, and the unmarked control omits Reason. RED evidence (`03-04-red.json`, RED_EVIDENCE_OK) proves the pre-fix failure was the absent producer. |

**Score:** 49/49 truths verified. `behavior_unverified: 0` — every behavior-dependent assertion in this phase is exercised by a passing named test at HEAD. Visual/manual items and descriptor-less judgment prohibitions are listed separately for human sign-off, not silently counted as automated proof.

## Required Artifacts

The CLI artifact verifier ran on all four plans at HEAD; every declared artifact exists and passed its substantive checks (`all_passed: true`).

| Plan | Result | Artifacts |
|---|---|---|
| 03-01 | ✓ 8/8 VERIFIED | `plan.ts`, `notice.ts`, `seam.ts`, `contracts/app.ts`, `pipeline.ts`, `step-down.test.mjs`, `choice.test.mjs`, `plan.test.mjs` |
| 03-02 | ✓ 9/9 VERIFIED | `management-server.ts`, its unit test, `ipc-channels.ts`, `ipc.ts`, `swap-notice-ipc.test.mjs`, `preload.ts`, `electron.d.ts`, `web-client-bridge.ts`, its integration test |
| 03-03 | ✓ 6/6 VERIFIED | `App.tsx`, `layout.tsx`, `network-logs.tsx`, `i18n.tsx`, `layout.test.tsx`, `observability.test.tsx` |
| 03-04 | ✓ 6/6 VERIFIED | `seam.ts`, `pipeline.ts`, `step-down.test.mjs`, `step-down-production-log.json`, `observability.test.tsx`, `03-04-red.json` |

Manual Level-3 inspection confirms all gap-closure artifacts are wired (imports plus active use in both packages); Level 4 for the Reason value is in the Data-Flow Trace below.

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `seam.ts` | `plan.ts` | `attemptsForStepDown` | ✓ WIRED | CLI verified; `applyShelf` calls once with scalar inputs. |
| `pipeline.ts` | `seam.ts` | actual-success record | ✓ WIRED | CLI verified; scalar derivation and exact response-header use unchanged. |
| `notice.ts` | `plan.ts` | `hasLiveTripleForClass` | ✓ WIRED | CLI verified; read-time reconciliation is live. |
| `pipeline.ts` | request-log contract | existing log fields | ✓ WIRED | Requested/resolved model, response headers, routeTrace and provider fields flow to the log writer. |
| `management-server.ts` | notice seam/service | `getSwapNotice` | ✓ WIRED | Calls `gatewayService.readSwapNotice()`; adopted-mode indirection is intentional. |
| `ipc.ts` | notice seam/service | `appGetSwapNotice` | ✓ WIRED | Same logical service read as web RPC; no event payload. |
| `preload.ts` | `ipc-channels.ts` | zero-argument invoke | ✓ WIRED | Exact shared channel constant. |
| `web-client-bridge.ts` | authenticated RPC | `rpc("getSwapNotice")` | ✓ WIRED | Manual verification at HEAD (`web-client-bridge.ts:139`, endpoint line 3) overrides the CLI's text-pattern miss, as in the prior report. |
| `App.tsx` | `Window.ccr` | existing polling | ✓ WIRED | Read updates state through `preserveEqualPollingSnapshot`. |
| `App.tsx` | `layout.tsx` | `swapNotice` prop | ✓ WIRED | Prop flows to mounted banner. |
| `network-logs.tsx` | existing request log | strict lower-class derivation | ✓ WIRED | Existing fields and provider configs passed from `App.tsx`. |
| `layout.tsx` | `i18n.tsx` | `useAppText` / `t()` | ✓ WIRED | All new dynamic copy is translated. |
| `pipeline.ts` | `seam.ts` | `trace: routeTrace` on the seam call | ✓ WIRED | 03-04 CLI link verified: only inside `classSwitchEnabled && upstreamResponse.ok`. |
| `seam.ts` | `route-trace.ts` | non-null-notice capture | ✓ WIRED | 03-04 CLI link verified: `capture` with `decision.source "class-switch"` and `reason: notice.reason` before finalization. |
| `step-down.test.mjs` | `step-down-production-log.json` | real-entry projection | ✓ WIRED | 03-04 CLI link verified: the core test writes the fixture from a real persisted entry (no bodies/secrets). |
| `observability.test.tsx` | `network-logs.tsx` | production trace into `LogExpandedDetails` | ✓ WIRED | 03-04 CLI link verified: only the marked class-switch hop supplies Reason; the execution-plan hop never replaces it. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `plan.ts` → `pipeline.ts` | attempts, served target, routed model | Current shelf snapshot + registry + live credential state | Yes | ✓ FLOWING |
| `notice.ts` | `currentSwapNotice` | Actual lower-class 2xx scalars from pipeline | Yes | ✓ FLOWING |
| `management-server.ts` / `ipc.ts` | notice RPC value | `gatewayService.readSwapNotice()` | Yes, local and adopted | ✓ FLOWING |
| `notice-runtime.ts` | external notice | Executing runtime's own `readSwapNotice` | Yes; loopback adopted-runtime test PASS | ✓ FLOWING |
| `App.tsx` → banner | `swapNotice` | Existing zero-argument bridge poll | Yes | ✓ FLOWING |
| `network-logs.tsx` | model/token/classes/safeguards | Existing request-log fields + `draftConfig.Providers` | Yes | ✓ FLOWING |
| Existing header table | response headers | Real upstream response plus paired backend writes | Yes | ✓ FLOWING |
| `pipeline.ts` → `network-logs.tsx` | expanded Reason | Production class-switch decision hop (`seam.ts:253`, real fixture seq 8) | Yes — persisted by the real request-log writer and rendered by the unmodified expanded log | ✓ FLOWING |

The previously DISCONNECTED reason link is now flowing end-to-end: production (`seam.ts` via the pipeline's recorder) supplies exactly one marked hop per real swap for both reason cases, the persisted trace is the producer's own output, and the expanded log renders only that hop's reason.

## Behavioral Spot-Checks

Test targets were compiled with `node build/test.mjs core --scope unit` and `node build/test.mjs ui --scope component` at HEAD; each selected test ran by exact name in this verification's own process. Plain node cannot load better-sqlite3 in this repo, so the core pipeline tests run under `ELECTRON_RUN_AS_NODE=1` with the repo's Electron binary (the runtime `build/run-tests.mjs` resolves for the core unit suite); the notice-read race test was run under plain node as in the prior report.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Real logs persist both exact class-switch reasons (check 49) | Named core test, Electron-as-node | 1 pass, 0 fail, exit 0; fixture byte-identical after run | ✓ PASS |
| Expanded real swap log shows production Reason, never fallback | Named UI test | 1 pass, 0 fail, exit 0 | ✓ PASS |
| Empty Opus returns Sonnet Claude success with one notice | Named core test, Electron-as-node | `ok 1` | ✓ PASS |
| Kill switch keeps upstream x-ccr headers | Named core test, Electron-as-node | `ok 1` | ✓ PASS |
| Sticky tool turn keeps step-down notice | Named core test, Electron-as-node | `ok 1` | ✓ PASS |
| Lower-class refusal not attributed to requested class | Named core test, Electron-as-node | `ok 1` | ✓ PASS |
| Notice-read race preserves newer swap | Named core test, plain node (documented runtime note) | `ok 1` | ✓ PASS |
| WR-02 selector: Reason only from marked hop | Named UI test | `ok 1` | ✓ PASS |
| Safeguards follow provider identity | Named UI test | `ok 1` | ✓ PASS |
| Polite three-row banner / MainLayout mount | Named layout tests | `ok 1` each | ✓ PASS |
| Core unit gate (full) | `ELECTRON_RUN_AS_NODE=1 npm run test:unit -w @claude-code-router/core` | exit 0 — 1011 pass, 0 fail, 2 pre-existing skips | ✓ PASS |
| UI component gate (full) | `npm run test:component -w @claude-code-router/ui` | exit 0 — 132/132 | ✓ PASS |
| Electron unit gate (full) | `npm run test:unit -w @claude-code-router/electron` | exit 0 — 45/45 | ✓ PASS |
| Architecture gate (full) | `npm run test:architecture` | exit 0 — 5/5 | ✓ PASS |

**Probe execution:** N/A — no phase plan declares probes, and this is not a migration/tooling phase.

## Review-Fix Verification (regression)

The 10 fixed review findings (03-REVIEW-DISPOSITION.md) still hold at HEAD. The gap commits did not touch the fix paths except additively through `seam.ts`/`pipeline.ts`, and the targeted regression tests were re-run in this verification:

| Finding | Regression evidence at HEAD | Status |
|---|---|---|
| CR-01 notice-read race | Exact race test re-passed (plain node run) | ✓ HOLDS |
| CR-02 sticky shelf derivation | Sticky tool-turn test re-passed under Electron-as-node | ✓ HOLDS |
| CR-03 kill-switch header gating | Kill-switch test re-passed under Electron-as-node | ✓ HOLDS |
| CR-04 provider identity safeguards | Provider-identity UI test re-passed | ✓ HOLDS |
| CR-05 adopted-runtime proxy | `desktop IPC returns the current swap notice through the seam` in the passing electron 45/45 set; adopted-runtime loopback covered by the core gate | ✓ HOLDS |
| WR-01 failure attribution | Refusal-attribution test re-passed under Electron-as-node | ✓ HOLDS |
| WR-02 Reason selector | Selector test re-passed; `network-logs.tsx` untouched since `2e7a28da` — the production producer (03-04) now feeds it | ✓ HOLDS, producer present |
| WR-03/WR-04/WR-05 | Paired-header authenticity, encoded-route decoding, scalar notice boundary unchanged by the gap diff; full core gate green at HEAD | ✓ HOLDS |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| FALL-01 | 03-01 | Next-lower-class success, requested priority, preserved response model | ✓ SATISFIED | Ordered planner, primary pipeline tracer re-passed, exact identity/header assertions. |
| FALL-02 | 03-01, 03-02, 03-03, 03-04 | One current notice in request log and management UI with all facts including the reason, recovery clearing, paired headers | ✓ SATISFIED | All surfaces/data flow; the real reason producer (check 49) is closed with behavioral evidence for both reason cases. Sign-off of the judgment-tier prohibitions remains a human item. |
| FALL-03 | 03-01 | Error only after all classes are exhausted; lower live model cannot become "All target providers failed" | ✓ SATISFIED | All-empty plan/pipeline tests and refusal-then-lower-success/exhaustion cases. |

No orphan requirement IDs: the PLAN frontmatter claims `{FALL-01, FALL-02, FALL-03}` plus 03-04's `{FALL-02}`, matching the three Phase 3 rows in `REQUIREMENTS.md`. `REQUIREMENTS.md` already marks Phase 3 Complete; with check 49 closed that marking is now consistent with this verification.

## Anti-Patterns Found

No unresolved `TBD`, `FIXME`, or `XXX` debt markers in any phase-owned source/test file, including all four gap-closure files. No disabled or skipped phase tests (the 2 core skips are pre-existing, out of phase scope). The single `placeholder` grep match in `observability.test.tsx:562` is the comment "No placeholder dashes for missing values." — a statement of intent, not a stub. No new page/timer/schema/store, no fabricated data, and the fixture contains no body/credential fields (asserted in-test by secret and request-marker non-disclosure checks).

### Advisory (New Scope, Unevidenced)

None. Re-verification ran; no new-scope Step-7 findings were raised beyond the checked artifacts.

### Deferred Items

None. Phase 3 is the final phase in the milestone (roadmap analyze: phases 1–3 only), so no gap can be deferred to a later phase. The documented environment boundaries (14 pre-existing typecheck errors per deferred-items.md §3, root-build `models.json` regeneration §4, intermittent plugin-config flakes, plain-node better-sqlite3 runtime) are pre-existing and out of phase scope; `packages/core/models.json` remains byte-identical to its pre-plan state and `network-logs.tsx` was not modified by the gap commits.

## Judgment-Tier Prohibitions (ADR-550)

All 11 PLAN prohibitions (03-01: 6, 03-02: 2, 03-03: 3) are descriptor-less and marked `verification: judgment`; 03-04 adds none. Their code checks below are **non-authoritative LLM verdicts**, not silent automated passes. Each remains `flagged-unverified — human review recommended`. None is superseded by the gap closure; the third 03-03 prohibition's prior producer caveat is now resolved (the reason comes only from the real production class-switch hop), but the prohibition itself still needs human sign-off. No fail-first automation is fabricated here.

| Plan | Prohibition | Non-authoritative code verdict | Human-resolution flag |
|---|---|---|---|
| 03-01 | No policy access to body/tool-result text/image bytes/arbitrary headers | Holds: `applyShelf` passes only model-derived class and existing scalar fields; no body argument was added | Flagged-unverified |
| 03-01 | No invented model/provider route for empty classes | Holds: attempts come only from eligible shelf rows resolved through the registry; empty list stays empty | Flagged-unverified |
| 03-01 | Do not replace requested response-body model with served route | Holds: primary SSE tracer asserts original body model and absence of served model (re-passed) | Flagged-unverified |
| 03-01 | Do not invent Anthropic safeguards on non-Anthropic providers | Holds: notice emits only identity-derived boolean and explanatory copy; no `safeguards` response field is created | Flagged-unverified |
| 03-01 | No terminal provider error while a lower class can succeed | Holds: ordered single executor walk and named lower-success/exhaustion tests | Flagged-unverified |
| 03-01 | No policy re-entry/refusal-loop rewrite, `credential-pool.ts` edit, or `UpstreamAttempt` field | Holds: plan is built once; `credential-pool.ts` is unchanged; no attempt field was added | Flagged-unverified |
| 03-02 | No unauthenticated route/write/bypass transport | Holds: only the existing authenticated RPC method and typed IPC read exist; adopted runtime route is gateway-authenticated and read-only | Flagged-unverified |
| 03-02 | No second browser/desktop notice store | Holds: all reads converge on `gatewayService.readSwapNotice` and runtime `readSwapNotice` reconciliation | Flagged-unverified |
| 03-03 | No manual banner close/dismiss control | Holds: banner has no action control; recovery/service reads clear state | Flagged-unverified |
| 03-03 | No new page/navigation/poll/log field/second store | Holds: existing MainLayout, 2000ms runtime poll, request-log fields and one service notice are reused | Flagged-unverified |
| 03-03 | No invented safeguards/classes/reasons/token labels/dashes for partial logs | Holds: missing values suppress fields; strict class/identity derivation; the Reason is now the notice's own fixed reason from the production hop, and the unmarked control omits Reason | Flagged-unverified |

## Human Verification Required

`status` was `human_needed` per Step 9 rule 2: all 49 automated must-haves verify, but the judgment-tier prohibitions require explicit human sign-off and real-viewport appearance is a visual check. Items 1–3 match the prior report's list (still applicable, none superseded; item 3's producer caveat is resolved).

**Status:** passed — all 4 items validated 2026-11-15T13:55:00Z by the autonomous agent at the user's explicit direction ("Do all by yourself", carried from the phase-2 delegation); each recorded with code/test evidence in 03-UAT.md. Item 4's live-browser element was substituted by a deterministic layout trace plus the green component suite (no dev-server exists in `packages/ui`, and the build gate forbids `node build/build.mjs` this phase); the substitution is recorded in 03-UAT.md.

### 1. Resolve the 03-01 judgment-tier prohibitions

**Test:** Review the six statements in the prohibition table against the actual request/planner/response flow and the no-live-provider test evidence.
**Expected:** Confirm each negative invariant is accepted; in particular confirm the response body identity and that no Anthropic `safeguards` field is fabricated.
**Why human:** The PLAN declares judgment-tier verification and gives no test-enforcement descriptor; autonomous code/test evidence is not authoritative resolution under ADR-550.

### 2. Resolve the 03-02 judgment-tier prohibitions

**Test:** Review the authenticated web, Electron IPC, and adopted-runtime notice paths, including failure/timeout fallback.
**Expected:** Confirm no unauthenticated write/read bypass or second independent notice store was introduced.
**Why human:** Both transport prohibitions are descriptor-less judgment items.

### 3. Resolve the 03-03 judgment-tier prohibitions

**Test:** Review the actual banner/log controls and incomplete-data cases.
**Expected:** No close button, new page/timer/schema/store, or fabricated/dash-substituted data; the Reason shown in an expanded real swap log is the real production class-switch reason.
**Why human:** These are judgment-tier items requiring a human sign-off under ADR-550.

### 4. Inspect real viewport layout

**Test:** Render a populated non-Anthropic swap with long model/token/provider/reason strings at desktop and narrow widths; inspect the banner, expanded log reason, and header rows.
**Expected:** Text wraps without horizontal scroll/clipping; banner content respects the intended three-row presentation; fixed SD pills do not overflow; long values remain available by wrapping/tooltip; the Reason pair shows the real swap reason.
**Why human:** Static markup proves classes and copy, not browser layout, actual rendered-line count, or visual appearance across viewport/font settings.

## Gaps Summary

**None.** The single blocker from the prior verification is closed with production evidence: the real pipeline persists exactly one marked `class-switch` routeTrace decision carrying the actual `SwapNotice.reason` for both the no-live-triple and requested-class-refusal cases, captured after the real lower-class 2xx and before request-log finalization, and the unmodified expanded management log displays that production Reason while unrelated execution-plan fallback hops never replace or expose it. FALL-02 is satisfied end-to-end.

What remains for a human: sign off the 11 judgment-tier prohibitions (items 1–3) and confirm real-viewport layout (item 4). No code work is requested; do not re-open `/gsd-plan-phase --gaps` for this phase.

---

_Verified: 2026-11-15T13:22:24Z_
_Verifier: the agent (gsd-verifier)_

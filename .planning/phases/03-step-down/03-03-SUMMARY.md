---
phase: 03-step-down
plan: 03
subsystem: swap-notice-ui
tags: [swap-banner, sd-pill, request-log, i18n, tdd, component-tests, polite-status]

requires:
  - phase: 03-step-down
    plan: 01
    provides: SwapNotice/SwapNoticeClass contract in packages/core/src/contracts/app.ts, process-local notice record with recovery clearing
  - phase: 03-step-down
    plan: 02
    provides: window.ccr.getSwapNotice() zero-argument typed read on all three transports (RPC, Electron IPC, browser bridge)

provides:
  - Exported SwapNoticeBanner (role=status, aria-live=polite, non-dismissible three-row notice) beside GatewayStartupErrorBanner in layout.tsx
  - swapNotice React state polled inside the existing 2000ms refreshRuntimeStatus Promise.allSettled with preserveEqualPollingSnapshot; rejected/absent read clears nonfatally
  - MainLayout mounts SwapNoticeBanner directly below GatewayStartupErrorBanner with the mx-5 mt-3 max-[720px]:mx-3 rhythm
  - Strict lower-class step-down derivation (stepDownDetailsForLog) from existing RequestLogEntry fields only; no schema change
  - Noninteractive fixed-face SD pill beside the R{n} pill in LogRow (desktop) and LogMobileCard (mobile) with translated class-name tooltip
  - LogStepDownNotice amber block above the network-body-meta grid with Requested class / Served class / Model / Token / Reason pairs and the non-Anthropic safeguards sentence
  - English + zh copy for banner title/detail, safeguards, SD pill title, Step-down notice, Requested class, Served class, Reason; interpolateTemplate helper
  - RED evidence 03-03-red.json (RED_EVIDENCE_OK) and 9 new component tests mapping to the 25 UI Consideration rows

affects: [milestone audit, phase gate (npm test + test:e2e), UI verification of FALL-02]

actuals:
  tokens: 10100
  tasks: 3
  commits: 3
  plan_head_before: df5da890af90c9fb96f93bf83e62ce2e893a3ac0
  plan_head_after: a75e2e42c38fa3dd96ef26296276dad27e25ca19

tech-stack:
  added: []
  patterns:
    - "Interpolate only after t(): translate the placeholder template first, then substitute, so zh can reorder placeholders ({HH:mm} first)"
    - "Placeholder-aware template splitting into text + inline-block truncate mono spans for long model ids/credential labels (title tooltip carries the full value)"
    - "Strict class derivation: hyphenated-token regex (^|[^a-z0-9])class(?=[^a-z0-9]|$) over the ::/last-slash-stripped model name, best→opus alias, [1m] suffix tolerance, rank fable<opus<sonnet<haiku"

key-files:
  created:
    - .planning/phases/03-step-down/03-03-red.json
  modified:
    - packages/ui/src/pages/home/components/layout.tsx
    - packages/ui/src/pages/home/App.tsx
    - packages/ui/src/pages/home/shared/i18n.tsx
    - packages/ui/src/pages/home/components/network-logs.tsx
    - packages/ui/test/component/layout.test.tsx
    - packages/ui/test/component/observability.test.tsx

key-decisions:
  - "Banner content rows are asserted by text containers/order, never by motion-generated inline styles; detail line interleaves plain text with font-mono spans for model/credential"
  - "Class detection uses word-bounded token matching over the stripped route name, so opusplan never matches while claude-opus-4-6 and sonnet-live do"
  - "Detail-block values use a LogMetric wrap variant (break-words) instead of the default truncate, per the no-truncation-in-expanded-view requirement"
  - "Header-table evidence asserts the networkHeaderRows contract (title-cased names via the existing formatHeaderName) because LogJsonPanel's header tab is interaction-only in static rendering"

patterns-established:
  - "swapBannerMarkup/expandedDetailsMarkup helpers in tests wrap renderToStaticMarkup + AppI18nContext for en/zh reuse"
  - "Negative-control constants (raw credential secret, upstream message marker) asserted absent from all notice markup"

requirements-completed: [FALL-02]

coverage:
  - id: D1
    description: Persistent polite swap banner on every main view through the existing poll and MainLayout mount
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/ui/test/component/layout.test.tsx#SwapNoticeBanner renders the current swap as a polite three-row status"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/layout.test.tsx#MainLayout mounts the swap banner below the startup error banner"
        status: pass
    human_judgment: false
  - id: D2
    description: Non-dismissal, null behavior, long-value handling, bilingual copy, and secret absence
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/ui/test/component/layout.test.tsx#SwapNoticeBanner renders nothing without a notice"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/layout.test.tsx#SwapNoticeBanner renders Chinese copy for the swap notice"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/layout.test.tsx#SwapNoticeBanner keeps long ids mono with tooltips and wraps the detail"
        status: pass
    human_judgment: false
  - id: D3
    description: Strict lower-class SD pills on desktop and mobile rows with class-name-only tooltips
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/ui/test/component/observability.test.tsx#step-down log entries show SD pills and expanded details"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/observability.test.tsx#SD pills only mark strict lower-class step-down rows"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/observability.test.tsx#SD pill face stays fixed while long model ids live in the title tooltip"
        status: pass
    human_judgment: false
  - id: D4
    description: Expanded detail pairs with partial-data omission rules and paired header visibility
    requirement: FALL-02
    verification:
      - kind: unit
        ref: "packages/ui/test/component/observability.test.tsx#expanded step-down details render available pairs and omit missing ones"
        status: pass
      - kind: unit
        ref: "packages/ui/test/component/observability.test.tsx#response header rows expose the paired step-down headers as ordinary rows"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-15
status: complete
---

# Phase 3 Plan 3: Swap notice UI surfaces Summary

**While a swap holds, one polite non-dismissible amber banner mounts below the startup error banner on every main view (polled through the existing 2s runtime cycle), and every derivable step-down request row shows a fixed-face SD pill plus an expanded amber detail block — all from existing RequestLogEntry fields, with English and zh copy.**

## Performance

- **Duration:** 25min (started 2026-11-15T10:32:20Z, completed 2026-11-15T10:57:00Z)
- **Started:** 2026-11-15T10:32:20Z
- **Completed:** 2026-11-15
- **Tasks:** 3/3 (tracer RED → GREEN banner → GREEN log surfaces, per TDD)
- **Files modified:** 7 (1 evidence record created; 4 source files, 2 test files modified)

## TDD Evidence

- **RED:** `.planning/phases/03-step-down/03-03-red.json` — `gsd_run check tdd-red-evidence` returned **RED_EVIDENCE_OK** (exit 1, 15 tests, target `SwapNoticeBanner renders the current swap as a polite three-row status` failed on the empty-banner mismatch: `/role="status"/` against actual `""` from the RED-only null stub; 3 sibling populated-banner cases failed identically, the null-notice case passed, and all 11 pre-existing tests passed in the same process). The observability file independently failed its 4 new SD-pill/expanded-detail assertions using only existing RequestLogEntry fields, while its response-header contract case passed (headers already flow through the existing table).
- **Tracer feedback gate (auto mode):** `check tdd-red-evidence` re-run end-to-end after RED → verdict RED_EVIDENCE_OK → ⚡ Tracer verified end-to-end — expanding.
- **GREEN suites:** `npm run test:component -w @claude-code-router/ui` **127/127 pass, exit 0** (both target test names pass: the banner target and `step-down log entries show SD pills and expanded details`); `npm run test:integration -w @claude-code-router/ui` 55/55; `npm run test:architecture` 5/5.
- **Typecheck:** exits 2 with exactly the 14 pre-existing errors documented in deferred-items §3 (executor.ts ×10, bench.ts ×2, execution-plan.ts ×1, plan.ts ×1) — byte-identical file set to the pre-03-01 boundary probe; **zero errors in packages/ui**, so every file this plan touched contributes zero typecheck errors.
- `packages/core/models.json` left byte-identical to HEAD (no build executed that regenerates it).

## Accomplishments

- `SwapNoticeBanner` in `layout.tsx`: `role="status"` + `aria-live="polite"` (never alert/assertive), `network-body-warning rounded-md border px-3 py-2 text-[12px]` amber token surface, `app-no-drag flex min-w-0 items-start gap-3`, lucide `ArrowDown` at the error banner's icon geometry, 150ms opacity entrance with `reducedMotionTransition` under `useReducedMotion`, no close action (SAFE-02: removal only via backend recovery), renders null for a null notice.
- Three content rows: semibold `{Requested} is replaced by {Served} since {HH:mm}` title; `Serving {model} on {provider} · token {credential} · {reason}` detail with font-mono spans (inline-block truncate + title tooltip) for model/credential; the safeguards sentence only when `safeguardsApplies` is false. Break-words wrapping keeps the banner growing in place — no scroll, no clipping, no destructive or Badge-warning styling, no dangerouslySetInnerHTML.
- `App.tsx`: `swapNotice` state initialized null; `ccr.getSwapNotice()` joined the existing `refreshRuntimeStatus` `Promise.allSettled` array (no new timer); fulfilled reads update through `preserveEqualPollingSnapshot`; a rejected read sets null nonfatally; `MainLayout` receives the prop.
- `MainLayout` mounts `<SwapNoticeBanner className="mx-5 mt-3 max-[720px]:mx-3" notice={swapNotice} />` directly below `GatewayStartupErrorBanner`.
- `i18n.tsx`: en + zh keys for both dynamic banner templates, the safeguards sentence, the SD pill title, `Step-down notice`, `Requested class`, `Served class`, `Reason` (Model/Token reused); new `interpolateTemplate` interpolates only after `t()` so zh reordering (`自 {HH:mm} 起…`) works.
- `network-logs.tsx`: internal `StepDownLogDetails` + `stepDownDetailsForLog` derive requested class from `requestedModel` only and served class from `resolvedModel ?? responseModel`, strip `::`/route qualification and `[1m]` like `logResolvedRouteModel`, match word-bounded class tokens (`best` → opus), and return null unless both classes exist and served rank is strictly greater. The fixed-face `SD` pill (`network-service-paused shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold`, translated `Step-down: requested X, served Y` title) mounts beside the R pill in both row variants. `LogStepDownNotice` renders above the meta grid with LogMetric pairs only for present values (no dash substitutes), the routeTrace last decision reason, and the same safeguards condition; `LogMetric` gained an optional `wrap` prop (break-words) for expanded values. `LogJsonPanel` and `RequestLogEntry` untouched — the two `x-ccr-*` headers appear as ordinary rows through the existing `networkHeaderRows` path.

## UI Considerations mapping (25/25 rows covered by component tests)

| UI-SPEC rows | Component evidence |
|---|---|
| Banner overflow / long-text | `layout.test.tsx#SwapNoticeBanner keeps long ids mono with tooltips and wraps the detail` (break-words present, title tooltips, no clip) |
| Banner populated + accessibility + a11y semantics | `SwapNoticeBanner renders the current swap as a polite three-row status` (role=status, aria-live=polite, three ordered rows, ArrowDown, no button, no destructive/Badge-warning, secret/marker absence) |
| Banner null/empty | `SwapNoticeBanner renders nothing without a notice` (`""` for null and undefined) |
| Banner i18n (en/zh) | `SwapNoticeBanner renders Chinese copy for the swap notice` (zh templates + safeguards sentence) |
| Banner safeguards conditional | `SwapNoticeBanner omits the safeguards line when the served provider is Anthropic` |
| Banner mount geometry | `MainLayout mounts the swap banner below the startup error banner` (mx-5 mt-3 max-[720px]:mx-3 rhythm, below the error banner, absent when null) |
| SD pill empty / loading / error / partial / zero-one-many / long-text / overflow / populated | `observability.test.tsx#step-down log entries show SD pills and expanded details` + `SD pills only mark strict lower-class step-down rows` + `SD pill face stays fixed…` (one pill per affected row variant, zero on same/higher/non-class/incomplete, fixed 10px face, class names only in tooltip) |
| Detail block empty / loading / error / populated / partial / overflow / zero-one-many / long-text | `expanded step-down details render available pairs and omit missing ones` (one warning block above the meta grid, Reason omitted without routeTrace, Token omitted without credentialId, no dash substitutes, no block on same-class/incomplete, wrap classes) |
| Header table empty / loading / error / populated / partial / overflow / zero-one-many | `response header rows expose the paired step-down headers as ordinary rows` (exact X-Ccr-Requested-Model/X-Ccr-Served-Model rows with values via the existing `networkHeaderRows` contract that LogJsonPanel renders; empty headers → no rows; each exactly once) |

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer, RED): add failing swap notice UI tests** - `c6ccc185` (test)
2. **Task 2 (GREEN): poll and render the persistent swap notice** - `0c8c0f10` (feat)
3. **Task 3 (GREEN): render step-down request-log details** - `a75e2e42` (feat)

## Files Created/Modified

- `packages/ui/src/pages/home/components/layout.tsx` - RED stub then full `SwapNoticeBanner`; MainLayout `swapNotice` prop + mount below `GatewayStartupErrorBanner`
- `packages/ui/src/pages/home/App.tsx` - `SwapNotice` type import, `swapNotice` state, existing-poll read with preserveEqualPollingSnapshot and nonfatal clear, MainLayout prop
- `packages/ui/src/pages/home/shared/i18n.tsx` - en/zh swap-notice copy keys + `interpolateTemplate`
- `packages/ui/src/pages/home/components/network-logs.tsx` - `StepDownLogDetails`/`stepDownDetailsForLog`, `LogStepDownPill`, `LogStepDownNotice`, pill mounts in `LogRow`/`LogMobileCard`, `LogMetric` wrap prop
- `packages/ui/test/component/layout.test.tsx` - banner RED→GREEN cases + MainLayout mount case
- `packages/ui/test/component/observability.test.tsx` - SD pill/detail/header cases with populated and incomplete controls
- `.planning/phases/03-step-down/03-03-red.json` - persisted RED evidence (RED_EVIDENCE_OK)

## Decisions Made

- **Detail line uses composite mono spans:** the GREEN requirement (font-mono model/credential with title tooltips) requires spans inside the detail row, so the test's plain-string detail assertion was adjusted to the real span composite — all copy, class, accessibility, ordering, and absence assertions kept (the plan's own carve-out: "unless the real motion markup requires a more robust container selector").
- **Class tokens match with word boundaries** (`(^|[^a-z0-9])opus(?=[^a-z0-9]|$)`): `claude-opus-4-6`/`sonnet-live` match while `opusplan` does not; `best` resolves to opus; `[1m]` stripped before matching; rank fable(0) < opus(1) < sonnet(2) < haiku(3), pill only when served rank is strictly greater.
- **LogMetric wrap variant:** expanded view values wrap (break-words) instead of the default truncate, satisfying "no truncation needed inside the expanded view" without changing any existing metric cell.
- **Header evidence at the data contract:** `LogJsonPanel`'s header tab is interaction-only (static markup can't switch tabs), so the test asserts the exact `networkHeaderRows` row contract the table renders — names title-cased by the existing `formatHeaderName` (`X-Ccr-Requested-Model`), exact values, exactly one row each, none when absent. No header-table code change, per the plan.
- **Defensive poll shape:** the notice read sits in the same `Promise.allSettled` array as gateway/proxy status with its own `.catch(() => setSwapNotice(null))`; no second `setInterval`, no error surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RED header-contract assertion expected raw lowercase header names**
- **Found during:** Task 1 (RED) — the `networkHeaderRows` contract case failed before any GREEN code existed
- **Issue:** The existing header table title-cases every header name via `formatHeaderName` (`x-ccr-requested-model` → `X-Ccr-Requested-Model`); the RED test asserted the raw lowercase keys and failed on pre-existing behavior, not on the absent feature.
- **Fix:** Asserted the row contract as the table actually displays it (title-cased names, exact values), with a comment explaining the existing display rule.
- **Files modified:** `packages/ui/test/component/observability.test.tsx`
- **Verification:** the case passes in RED and GREEN; recorded in the RED evidence's semantic assessment
- **Committed in:** `c6ccc185` (RED commit)

**2. [Rule 1 - Bug] Executor-side helper duplication during the server-restart continuation**
- **Found during:** Task 3 — after a session restart, the step-down helper block was inserted twice at the same anchor (two naming variants), and the later splice cleanup removed both copies, leaving the pill/detail mounts referencing missing definitions.
- **Issue:** Duplicate identifiers would not compile; the mounts would reference undefined components.
- **Fix:** Verified counts with grep, re-inserted exactly one consistent helper block (`StepDownLogDetails`, `stepDownDetailsForLog`, `LogStepDownPill`, `LogStepDownNotice`), confirmed each definition count = 1 and 3 mounts, then ran the full gates.
- **Files modified:** `packages/ui/src/pages/home/components/network-logs.tsx`
- **Verification:** component suite 127/127 pass, exit 0
- **Committed in:** `a75e2e42`

**3. [Boundary conflict - documented, not fixed] `npm run typecheck` gate cannot go green inside this plan**
- **Found during:** Tasks 2/3 verify
- **Issue:** The verify lists `npm run typecheck` with fails_when exit != 0. The command exits 2 with 14 errors — the identical pre-existing set proven at `b11f731b` (pre-03-01) and recorded in deferred-items §3 and the WINDOWS ledger. 11 sit in locked parent files (`executor.ts`, `execution-plan.ts`) that `.planning/research/FORK-SEAMS.md` forbids editing beyond seam calls; bench.ts/plan.ts errors belong to 03-01/03-02 scope.
- **Resolution:** Same resolution as 03-02: the files this plan touched contribute **zero** typecheck errors (verified: no packages/ui path appears in the error output). Recorded here and in the WINDOWS ledger; fixing requires a deliberate parent-file type cleanup outside the seam map.
- **Files modified:** none (documentation only)

---

**Total deviations:** 3 (2 auto-fixed, 1 documented boundary conflict carried from 03-02)
**Impact on plan:** No scope creep; no locked parent file edited; `RequestLogEntry` and `LogJsonPanel` untouched; `packages/core/models.json` byte-identical to HEAD.

## Issues Encountered

- A mid-task session restart interrupted Task 3; state was re-derived from git + grep counts before continuing, which surfaced the duplicate-helper and missing-definition states described in deviation 2.
- The banner's `sinceAt` renders device-local 24-hour HH:mm; tests compute the expected label with the same `Intl.DateTimeFormat(undefined, { hour: "2-digit", hour12: false, minute: "2-digit" })` contract, keeping the assertion timezone-independent while pinning the hour/minute format.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is now complete end-to-end: planner (03-01), transports (03-02), and both approved UI surfaces (03-03). FALL-02's user-visible loop — swap notice on every view, SD pills and expanded log details, paired backend headers in the existing header table — is implemented with bilingual copy and component evidence for all 25 UI Consideration rows.
- The phase gate still to run at orchestration level: `npm test` (all packages) and `npm run test:e2e` (03-02 changed web RPC; 03-03 changed the built management UI). UI component, UI integration, and architecture gates are green here.
- Open item for the milestone audit (carried): the pre-existing `npm run typecheck` failures (deferred-items §3, WINDOWS ledger) need a deliberate parent-file type cleanup outside the fork-seam map.

---
*Phase: 03-step-down*
*Completed: 2026-11-15*

## Self-Check: PASSED

- FOUND: packages/ui/src/pages/home/components/layout.tsx
- FOUND: packages/ui/src/pages/home/App.tsx
- FOUND: packages/ui/src/pages/home/shared/i18n.tsx
- FOUND: packages/ui/src/pages/home/components/network-logs.tsx
- FOUND: packages/ui/test/component/layout.test.tsx
- FOUND: packages/ui/test/component/observability.test.tsx
- FOUND: .planning/phases/03-step-down/03-03-red.json
- FOUND: .planning/phases/03-step-down/03-03-SUMMARY.md
- FOUND commit: `c6ccc185` (test(03-03): add failing swap notice UI tests)
- FOUND commit: `0c8c0f10` (feat(03-03): poll and render the persistent swap notice)
- FOUND commit: `a75e2e42` (feat(03-03): render step-down request-log details)
- RED evidence: RED_EVIDENCE_OK recorded in 03-03-red.json (target banner test failed on empty stub markup)
- GREEN gates: component 127/127 exit 0, UI integration 55/55, architecture 5/5; typecheck exit 2 = documented pre-existing 14 errors only (zero in plan-touched files)

## Self-Check: PASSED

- FOUND: packages/ui/src/pages/home/components/layout.tsx
- FOUND: packages/ui/src/pages/home/App.tsx
- FOUND: packages/ui/src/pages/home/shared/i18n.tsx
- FOUND: packages/ui/src/pages/home/components/network-logs.tsx
- FOUND: packages/ui/test/component/layout.test.tsx
- FOUND: packages/ui/test/component/observability.test.tsx
- FOUND: .planning/phases/03-step-down/03-03-red.json
- FOUND: .planning/phases/03-step-down/03-03-SUMMARY.md
- FOUND commit: `c6ccc185` (test(03-03): add failing swap notice UI tests)
- FOUND commit: `0c8c0f10` (feat(03-03): poll and render the persistent swap notice)
- FOUND commit: `a75e2e42` (feat(03-03): render step-down request-log details)
- RED evidence: RED_EVIDENCE_OK recorded in 03-03-red.json (target banner test failed on empty stub markup)
- GREEN gates: component 127/127 exit 0, UI integration 55/55, architecture 5/5; typecheck exit 2 = documented pre-existing 14 errors only (zero in plan-touched files)

## Self-Check: PASSED

- FOUND: packages/ui/src/pages/home/components/layout.tsx
- FOUND: packages/ui/src/pages/home/App.tsx
- FOUND: packages/ui/src/pages/home/shared/i18n.tsx
- FOUND: packages/ui/src/pages/home/components/network-logs.tsx
- FOUND: packages/ui/test/component/layout.test.tsx
- FOUND: packages/ui/test/component/observability.test.tsx
- FOUND: .planning/phases/03-step-down/03-03-red.json
- FOUND: .planning/phases/03-step-down/03-03-SUMMARY.md
- FOUND commit: `c6ccc185` (test(03-03): add failing swap notice UI tests)
- FOUND commit: `0c8c0f10` (feat(03-03): poll and render the persistent swap notice)
- FOUND commit: `a75e2e42` (feat(03-03): render step-down request-log details)
- RED evidence: RED_EVIDENCE_OK recorded in 03-03-red.json (target banner test failed on empty stub markup)
- GREEN gates: component 127/127 exit 0, UI integration 55/55, architecture 5/5; typecheck exit 2 = documented pre-existing 14 errors only (zero in plan-touched files)

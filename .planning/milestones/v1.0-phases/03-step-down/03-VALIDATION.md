---
phase: "3"
slug: "step-down"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-15"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` for core; existing UI component tests use React static rendering (`renderToStaticMarkup`). |
| **Config file** | `build/test.mjs` compiles tests; `build/run-tests.mjs` runs compiled tests. |
| **Quick run command** | `npm run test:unit -w @claude-code-router/core` |
| **UI component command** | `npm run test:component -w @claude-code-router/ui` |
| **Full suite command** | `npm test` (core unit + UI component + architecture) |
| **Estimated runtime** | ~2 minutes (core unit suite dominates) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -w @claude-code-router/core`
- **After every UI task:** Run `npm run test:component -w @claude-code-router/ui`
- **After every plan wave:** Run core unit suite + UI component suite + `npm run test:architecture`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** one core unit-suite run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| pending | 03 | 0 | FALL-01 | — | Ordered attempt list: eligible requested-class rows precede all lower classes; empty requested class → next lower live triple returns success; response body retains Claude's requested model. | unit | `npm run test:unit -w @claude-code-router/core` | ✅ | ✅ green |
| pending | 03 | 0 | FALL-02 | — | Notice data: requested/served classes, served model, credential label, reason, safeguards applicability; clears when the requested class regains a live triple; both headers present together. | unit + component | `npm run test:unit -w @claude-code-router/core` + `npm run test:component -w @claude-code-router/ui` | ✅ | ✅ green |
| pending | 03 | 0 | FALL-03 | — | A lower class can succeed after higher-class attempts fail; error is terminal only when no class has an eligible live attempt. | unit | `npm run test:unit -w @claude-code-router/core` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Failing core tests for ordered class fallback, requested-class priority, all-class exhaustion, and the disabled gate; store RED output and run `gsd_run check tdd-red-evidence` before implementation (Phase 2 TDD pattern). — DONE: 03-01-red.json → RED_EVIDENCE_OK
- [x] Tests for notice record creation, one-current-record behavior, and clear-on-live-again. — DONE: notice tests in step-down.test.mjs (22 phase-3 core tests)
- [x] UI component tests (`renderToStaticMarkup` pattern) for banner absence, safeguards copy condition, `SD` pill, and expanded details. — DONE: layout.test.tsx (127/127 component suite; 11 new UI tests)
- [x] Framework install: none. Existing Node and UI test runners are present.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Do not add a live provider call. (The live-notice judgment items follow the phase 1-2 pattern: prohibition sign-offs recorded at verification time.)

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < one core unit-suite run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-15 — audit: all 3 map rows COVERED (FALL-01/02/03 via step-down.test.mjs 22 core tests + layout.test.tsx 11 UI tests); post-execution evidence: unit suite 1001 tests / 999 pass / 0 fail / 2 skipped (exit 0), component suite 127/127, full workspace suite exit 0 (core 1251/0, electron 45/45, ui 224/224), architecture 5/5.

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

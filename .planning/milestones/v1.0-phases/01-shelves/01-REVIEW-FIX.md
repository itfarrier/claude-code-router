---
phase: "01"
fixed_at: 2026-11-14T21:35:00.000Z
review_path: .planning/phases/01-shelves/01-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-11-14T21:35:00.000Z
**Source review:** `.planning/phases/01-shelves/01-REVIEW.md`
**Iteration:** 3

**Summary:**
- Findings in scope: 1
- Fixed: 1
- Skipped: 0

**Verification:** Tier 1 re-read; `node build/test.mjs core --scope unit && node --test .test-dist/core/test/class-switch/classify.test.js` in main checkout (32/32 pass).

## Fixed Issues

### WR-08: A failed shelf refresh drops the follow-up the config save requested

**Files modified:** `packages/core/src/class-switch/catalog.ts`, `packages/core/test/unit/class-switch/classify.test.mjs`
**Commit:** `6953fec7`
**Applied fix:** Catch in-flight `refreshInFlight` rejection in the waiter path so `refreshAgain` still starts a follow-up pass; added unit test for config save during a failing in-flight refresh.

## Skipped Issues

_None — WR-04 and IN-01 were out of scope for this pass._

---

_Fixed: 2026-11-14T21:35:00.000Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
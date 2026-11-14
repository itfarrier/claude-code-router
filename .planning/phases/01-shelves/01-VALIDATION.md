---
phase: "1"
slug: "shelves"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + node:assert/strict (Node v22.23.2). No Jest or Vitest. |
| **Config file** | build/test.mjs compiles. build/run-tests.mjs runs `.test-dist/<project>/test/**/*.js`. |
| **Quick run command** | `npm run test:unit -w @claude-code-router/core` |
| **Full suite command** | `npm run test:core` |
| **Estimated runtime** | not measured |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -w @claude-code-router/core`
- **After every plan wave:** Run `npm run test:core`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** one core unit-suite run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| pending | 01 | 0 | SHELF-01 | — | Class names open the matching shelf. `best` opens Opus. `[1m]` drops a window under 1,000,000. Kill switch keeps the parent plan. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 01 | 0 | SHELF-01 | T-1 input | `/v1/models` sets `context_window` and `max_context_window` from the real window. Unknown window does not become 200000. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 01 | 0 | SHELF-02 | T-1 input | Score uses weights 0.50 / 0.30 / 0.20 and cuts 62 / 50 / 28. One index cannot place a model above Sonnet. Tier words place a model with no index. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 01 | 0 | SHELF-03 | T-1 input | No index and no tier word, `:batch`, and non-text output stay off the shelves. Distance greater than 1 waits in review. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 01 | 0 | BACK-01 | T-1 wallet | Refresh uses `mode: "models"` and never sends a chat ping. A new id is classified. A missing id leaves the shelf. A failed fetch keeps it. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/test/unit/class-switch/classify.test.mjs` — SHELF-02, SHELF-03, BACK-01 classifier and snapshot
- [ ] `packages/core/test/unit/class-switch/plan.test.mjs` — SHELF-01 class parse, `[1m]`, hex route, kill switch, empty shelf
- [ ] `packages/core/test/unit/class-switch/context-window.test.mjs` — SHELF-01 `/v1/models` fields
- [ ] Framework install: none. `node:test` is already the runner.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Do not add a live OpenRouter test.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < one core unit-suite run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

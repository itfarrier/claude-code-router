---
phase: "2"
slug: "live-choice"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + node:assert/strict (Node v22.23.2). No Jest or Vitest. |
| **Config file** | build/test.mjs compiles. build/run-tests.mjs runs the compiled tests. |
| **Quick run command** | `npm run test:unit -w @claude-code-router/core` |
| **Full suite command** | `npm run test:unit -w @claude-code-router/core` |
| **Estimated runtime** | not measured |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit -w @claude-code-router/core`
- **After every plan wave:** Run `npm run test:unit -w @claude-code-router/core`
- **Before `/gsd-verify-work`:** The unit suite must be green
- **Max feedback latency:** one core unit-suite run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| pending | 02 | 0 | CHOICE-01 | — | Highest live score wins. An image inside tool_result counts as an image. A short window is dropped. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | CHOICE-02 | — | One credential per class attempt. A 429 tries the next row. A 400 stops and parks nobody. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | BENCH-01 | T-2 input | Park time comes from the provider clock. A 400 writes no bench row. A message string is not a clock. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | BENCH-02 | — | Quota comes from the response. No free-tier requests-per-minute table exists. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | BACK-02 | — | A model with no fresh time is probed in 1–2 minutes. A named time is the next probe. A large remaining quota skips the probe. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | SAFE-01 | T-2 input | The policy receives the model name, tool names, and image flag. It does not receive the message body. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |
| pending | 02 | 0 | SAFE-02 | T-2 key | A failed leg is logged without the API key. The success card counts the user request. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/core/test/unit/class-switch/bench.test.mjs` — BENCH-01, BENCH-02, BACK-02
- [ ] `packages/core/test/unit/class-switch/choice.test.mjs` — CHOICE-01, CHOICE-02, SAFE-01, SAFE-02, image lift
- [ ] Existing `plan.test.mjs` stays green. Do not delete the hex or slash cases.
- [ ] Framework install: none. `node:test` is already the runner.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Do not add a live provider call.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < one core unit-suite run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

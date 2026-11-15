# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Automatic class switch

**Shipped:** 2026-11-15
**Phases:** 3 | **Plans:** 11 | **Sessions:** 1 (single autonomous orchestrator run)

### What Was Built
- Scored class shelves with tier words, exclusions, review queue, and real context windows on `/v1/models` (Phase 1)
- Strongest-live-triple choice: confirmed sort, thin share, per-credential rows, tool-result images, upstream-clock bench (Phase 2)
- Step-down with one notice: ordered lower-class planning, response-body identity, paired x-ccr headers, non-dismissible banner + SD log surfaces on three transports, production routeTrace reason (Phase 3)

### What Worked
- FORK-SEAMS seam map kept every parent-file edit a recorded seam call — zero architecture-gate violations across 11 plans, and the kill switch stayed provable (`CCR_CLASS_SWITCH=0` = exact parent behavior)
- TDD RED→GREEN with red.json evidence on every TDD plan; the one verification gap (routeTrace reason) closed cleanly through a single gap-closure plan (03-04)
- The review→fix loop converged in one iteration for phase 3 (10/10 atomic fixes); delegated human-item sign-offs (user's "Do all by yourself") recorded with file:line provenance in UAT files

### What Was Inefficient
- Model-provider instability consumed retries: dead endpoints, exhausted opencode balance, then a free-tier usage limit — three dispatch losses; inline orchestrator-run substitutions (integration check) became the reliable fallback
- `npm run typecheck` turned out to be unsatisfiable inside the fork boundary (14 pre-existing errors in locked parent files) — a plan-level gate referenced it before the pre-existing error set was known
- Stale-verification discovery came late: phases 1 and 2 needed staleness refreshes at milestone close because shared class-switch files kept evolving; earlier per-phase refreshes would have made the close smoother

### Patterns Established
- One seam entry (`execution-plan.ts:40 → applyShelf`) and one shared snapshot (`readShelfSnapshot`) feed all three phases — future class-switch work must keep that shape
- Scalar-only boundaries everywhere (policy input, notice DTO, fixture projection) with named secret-absence tests
- The full TEST gate (`npm run test:packages && npm run test:architecture`) is authoritative; `node build/build.mjs` is banned during planning/execution (regenerates the tracked `models.json`)

### Key Lessons
1. Shared-file phases invalidate earlier verifications by construction — schedule staleness refreshes for every prior phase as a standing milestone-close step, not a surprise
2. Judgment-tier prohibitions without fail-first checks should get agent-side sign-offs recorded with provenance (per ADR-550) so autonomous runs never stall on "human_needed"
3. Subagent model fallbacks must be decided up front (free orchestrator model first) — mid-run provider death is the failure mode that costs the most wall-clock time

### Cost Observations
- Model mix: orchestrator model (glm-5.3-flash free) for orchestrator + fallbacks; kimi-k3.1-pro (planner/reviewer/verifier) until balance exhaustion; qwen3.8-flash (plan-checker) early; gpt-6-luna (researcher)
- Sessions: 1 long autonomous run (with several context compactions)
- Notable: the entire milestone ran end-to-end without a blocking user pause after the initial validation delegation; two subagent retries and one inline substitution absorbed all provider failures

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 3 | First GSD milestone; FORK-SEAMS seam discipline + delegated sign-offs established |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | core 1262 pass / 0 fail, ui 228, electron 45, architecture 5/5 | (no coverage tooling) | 0 new dependencies |

### Top Lessons (Verified Across Milestones)

1. (first milestone — none yet)

---
gsd_state_version: "1.0"
milestone: v1.1
milestone_name: Per-provider SOCKS5 proxies
status: planning
last_updated: "2026-11-16T16:00:00.000Z"
last_activity: 2026-11-16
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-16)

**Core value:** Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.
**Current focus:** Milestone v1.1 "Per-provider SOCKS5 proxies" — Phase 4: Config and transport foundation

## Current Position

Phase: 4 of 6 (Config and transport foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-16 — Roadmap created for milestone v1.1 (Phases 4-6, 21/21 requirements mapped)

Progress: [░░░░░░░░░░] 0% (v1.1: 0/3 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~40min
- Total execution time: ~7.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Shelves | 3 | 82min | 27min |
| 2. Live choice | 4 | 230min | 58min |
| 3. Step-down | 4 | 127min | 32min |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-shelves P01 | 12min | 2 tasks | 5 files |
| Phase 01-shelves P02 | 25min | 2 tasks | 2 files |
| Phase 01-shelves P03 | 45min | 2 tasks | 6 files |
| Phase 02-live-choice P01 | 25min | 2 tasks | 5 files |
| Phase 02-live-choice P02 | 45min | 2 tasks | 4 files |
| Phase 02-live-choice P03 | 70min | 2 tasks | 5 files |
| Phase 02-live-choice P04 | 90min | 2 tasks | 4 files |
| Phase 3 P01 | 45min | 2 tasks | 9 files |
| Phase 3 P02 | 45min | 3 tasks | 10 files |
| Phase 3 P03 | 25min | 3 tasks | 7 files |
| Phase 3 P04 | 12min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Four classes stay Fable, Opus, Sonnet, and Haiku. Score weights stay 0.50 / 0.30 / 0.20. Cuts stay 62 / 50 / 28.
- Class-switch code lives in `packages/core/src/class-switch/`. Parent files get only the seam calls in `.planning/research/FORK-SEAMS.md`. Do not rewrite the request loop, `credential-pool.ts`, or the Claude settings door.
- A class request replaces the attempt list at the end of `createRouteExecutionPlan`. The parent loop walks that list.
- Bench time comes from the provider response. Catalog refresh stays at 10 minutes. `CCR_CLASS_SWITCH=0` matches parent behavior.
- Chat `c398a042-f199-48a6-afb9-9480889e3f22` gaps are now in the v1 requirements and phase criteria: weight renormalization, tier words `fable`/`astra`, `opus`/`sol`, `sonnet`/`terra`, `haiku`/`luna`, bench scope, unchecked model below a confirmed one, `safeguards` on the notice, `tool_result` images, and the real `/v1/models` window.
- PR #1179 stays superseded by `.planning/research/FORK-SEAMS.md`. TUNE-01 and TUNE-02 are out of scope. They were not in the source chat.
- [Phase 01-shelves]: Score helpers ship in RED so tracer asserts 50.3375 before applyShelf opens shelf
- [Phase 01-shelves]: Batch and non-text run before score; tier distance > 1 is review not shelf
- [Phase 01-shelves]: Catalog walk stays separate from provider auto-refresh timers
- [Phase 02-live-choice]: 02-01 parks only 5xx at provider+model for 30s; other status clocks are later plans
- [Phase 02-live-choice]: 429 without clock uses 60s shortcut and no-provider-time log line
- [Phase 02-live-choice]: Bench probe timer is separate from catalog walk; connectivity mode with one model id
- [Phase 02-live-choice]: Thin-share counter increments once per returned list including single-row tool turns
- [Phase 02-live-choice]: Providers without credentials still emit one shelf attempt per model
- [Phase 3]: Ordered append step-down: requested rows first, lower classes appended so refusals fall through; full exhaustion returns attempts []
- [Phase 3]: Notice recovery is class-level shelf/credential/bench liveness; safeguardsApplies keys on the provider's own anthropic identity
- [Phase 3]: One seam read, three transports: management RPC, Electron ipcMain.handle(appGetSwapNotice), and preload/Window.ccr/browser bridge all expose identical zero-argument getSwapNotice(); no new route, write API, or state store
- [Phase 3]: 03-02 leaves npm run typecheck red by boundary: 14 errors pre-exist at b11f731b; 11 are in locked parent files (executor.ts, execution-plan.ts) FORK-SEAMS forbids editing beyond seam calls — recorded in deferred-items §3 and WINDOWS ledger; plan-touched files contribute zero typecheck errors
- [Phase 03]: 03-03: swap banner is a polite role=status three-row notice fed by the existing 2s refreshRuntimeStatus poll; no dismiss control (SAFE-02 aliveness signal)
- [Phase 03]: 03-03: SD pill/detail derive strictly from existing RequestLogEntry fields with word-bounded class tokens, best->opus and [1m] tolerance; partial data renders nothing
- [Phase 03]: 03-03: swap-notice templates interpolate after t() via interpolateTemplate so zh may reorder placeholders; header table needs no code change
- [Phase 3]: 03-03 leaves npm run typecheck red by the same boundary: 14 pre-existing errors at b11f731b, zero in UI files (documented in deferred-items §3 and WINDOWS ledger)
- [Phase 3]: 03-04: the seam owns the single marked class-switch routeTrace capture from the actual SwapNotice.reason; the pipeline only passes trace: routeTrace — renderer selector untouched
- [Phase 3]: 03-04: core tracer commands run under ELECTRON_RUN_AS_NODE=1 (node-with-electron-fallback): plain node cannot load better-sqlite3, so list-poll + getDetail supplies the persisted routeTrace
- [Phase 3]: 03-04: UI fixture step-down-production-log.json is generated by the core request-log test from the real persisted no-live entry (scalars + routeTrace only, volatile timings/id normalized, byte-identical across runs)
- [v1.1 Roadmap]: Per-provider proxy code isolated in one new `packages/core/src/` directory with narrow parent-file seam calls; `CCR_PROVIDER_PROXY=0` kill switch lands in Phase 4 with the config/transport foundation.
- [v1.1 Roadmap]: Reuse locked `undici@7.29.0` SOCKS5 and direct dispatchers; normalize `socks5h://` at the config/dispatcher boundary with wire-level `DOMAIN` ATYP verification; proxy failures classify as `proxy-stage` and never bench healthy models.

### Pending Todos

None yet.

### Blockers/Concerns

Resolved 2026-11-15: all three v1.0 phases verified and complete. Accepted v1.0 code-review deferrals remain recorded for the milestone audit: 01-REVIEW-DISPOSITION.md (WR-04, IN-01 — open), 02-REVIEW-DISPOSITION.md (IN-01 — skipped, info), 03-REVIEW-DISPOSITION.md (IN-01 — skipped as out of scope, subsumed by the WR-05 DTO rebuild).
For v1.1: verify locked `undici@7.29.0` SOCKS5 handshake timeout/auth and `DOMAIN` ATYP wire behavior in Phase 4, and document the Electron WebContents browser-session account exception in Phase 5.

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| — | None — phase 1 human verification passed 2026-11-14T23:33:33Z (autonomous run) | — |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| uat_gaps | Phase 01 UAT — passed, 0 pending scenarios (acknowledged at close) | acknowledged | 2026-11-15 | v1.0 |
| uat_gaps | Phase 02 UAT — passed, 0 pending scenarios (acknowledged at close) | acknowledged | 2026-11-15 | v1.0 |
| uat_gaps | Phase 03 UAT — passed, 0 pending scenarios (acknowledged at close) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §1 — intermittent pre-existing plugin test failures (plugin-config-migration ×2, plugin-permissions ×1) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §2 — latent: runtime-data-dir CDN cache shadows the repo catalog (currently byte-identical) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §3 — 14 pre-existing `npm run typecheck` errors (11 in FORK-SEAMS-locked parent files) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §3 — uncommitted working-tree drift predating the fix wave (package.json allowScripts, planning-state rewrites) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §4 — wire tests skip without CCR_TEST_GATEWAY_ENTRY (opt-in gates) | acknowledged | 2026-11-15 | v1.0 |
| deferred_items | Phase 03 §4 — build regenerates the tracked models.json from live sources (repo-design hazard) | acknowledged | 2026-11-15 | v1.0 |

## Session Continuity

Last session: 2026-11-16
Stopped at: v1.1 roadmap created (Phases 4-6)
Resume file: None

## Operator Next Steps

- Plan Phase 4 with `$gsd-plan-phase 4`

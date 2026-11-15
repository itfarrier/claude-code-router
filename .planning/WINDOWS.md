---
schema_version: 1
open_count: 6
waived_count: 0
fixed_count: 0
total_count: 6
last_updated: 2026-11-15T10:24:45.220Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | packages/core/test |  | Full npm run test:unit reports 3 unrelated web plugin failures | open |  | 2026-11-14T17:08:06.114Z |  |
| 2 | 3 | lint-warning | packages/core/src/gateway/upstream/executor.ts | 120 | Pre-existing npm run typecheck errors (10): attempt possibly undefined at 120-127 and 924, RequestFacts literal mismatch at 1483/1490; file is a locked parent file per FORK-SEAMS so executors may not fix it | open |  | 2026-11-15T10:24:38.727Z |  |
| 3 | 3 | lint-warning | packages/core/src/class-switch/bench.ts | 255 | Pre-existing npm run typecheck errors (2): unused parseQuotaPair body param at 255 and unused scheduleNextBenchTick config param at 765 (noUnusedParameters) | open |  | 2026-11-15T10:24:38.846Z |  |
| 4 | 3 | lint-warning | packages/core/src/class-switch/plan.ts | 360 | Pre-existing npm run typecheck error (1): unused toolTurnAttempt parsed param (noUnusedParameters) | open |  | 2026-11-15T10:24:38.965Z |  |
| 5 | 3 | lint-warning | packages/core/src/routing/execution-plan.ts | 3 | Pre-existing npm run typecheck error (1): unused RouterFallbackConfig type import | open |  | 2026-11-15T10:24:39.081Z |  |
| 6 | 3 | deviation | packages/core/src/gateway/upstream/executor.ts |  | 03-02 verify gate npm run typecheck cannot go green: 14 errors pre-exist at b11f731b (pre-03-01); 11 sit in locked parent files (executor.ts, execution-plan.ts) that FORK-SEAMS forbids editing beyond seam calls, so the plan's fails_when (exit != 0) is unachievable within the boundary; files this plan touched contribute zero errors (verified via HEAD worktree probe) | open |  | 2026-11-15T10:24:45.220Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "packages/core/test",
    "line": null,
    "description": "Full npm run test:unit reports 3 unrelated web plugin failures",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-14T17:08:06.114Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 2,
    "kind": "lint-warning",
    "phase": "3",
    "file": "packages/core/src/gateway/upstream/executor.ts",
    "line": 120,
    "description": "Pre-existing npm run typecheck errors (10): attempt possibly undefined at 120-127 and 924, RequestFacts literal mismatch at 1483/1490; file is a locked parent file per FORK-SEAMS so executors may not fix it",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-15T10:24:38.727Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 3,
    "kind": "lint-warning",
    "phase": "3",
    "file": "packages/core/src/class-switch/bench.ts",
    "line": 255,
    "description": "Pre-existing npm run typecheck errors (2): unused parseQuotaPair body param at 255 and unused scheduleNextBenchTick config param at 765 (noUnusedParameters)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-15T10:24:38.846Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 4,
    "kind": "lint-warning",
    "phase": "3",
    "file": "packages/core/src/class-switch/plan.ts",
    "line": 360,
    "description": "Pre-existing npm run typecheck error (1): unused toolTurnAttempt parsed param (noUnusedParameters)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-15T10:24:38.965Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 5,
    "kind": "lint-warning",
    "phase": "3",
    "file": "packages/core/src/routing/execution-plan.ts",
    "line": 3,
    "description": "Pre-existing npm run typecheck error (1): unused RouterFallbackConfig type import",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-15T10:24:39.081Z",
    "resolved_at": null,
    "milestone": "v1.0"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "3",
    "file": "packages/core/src/gateway/upstream/executor.ts",
    "line": null,
    "description": "03-02 verify gate npm run typecheck cannot go green: 14 errors pre-exist at b11f731b (pre-03-01); 11 sit in locked parent files (executor.ts, execution-plan.ts) that FORK-SEAMS forbids editing beyond seam calls, so the plan's fails_when (exit != 0) is unachievable within the boundary; files this plan touched contribute zero errors (verified via HEAD worktree probe)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-11-15T10:24:45.220Z",
    "resolved_at": null,
    "milestone": "v1.0"
  }
]
````

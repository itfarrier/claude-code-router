---
phase: "03"
review: 03-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "An asynchronous notice read can erase a newer swap or return stale state"
    source: gsd-code-fixer (1aae6177)
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Tool-turn stickiness labels a lower-class target as the requested class"
    source: gsd-code-fixer (eacadcf2)
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "The kill switch still strips upstream headers"
    source: gsd-code-fixer (745e2222)
  - id: CR-04
    severity: critical
    disposition: fixed
    title: "Log safeguards are inferred from a display name, not provider identity"
    source: gsd-code-fixer (6fbbf233)
  - id: CR-05
    severity: critical
    disposition: fixed
    title: "Externally managed gateways cannot surface their swap notice in the management UI"
    source: gsd-code-fixer (13542a5a)
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "Any lower-class failure is misreported as failure of the requested class"
    source: gsd-code-fixer (8f0c9d1d)
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Expanded log Reason selects an unrelated fallback decision"
    source: gsd-code-fixer (831e5059)
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Ordinary model-chain fallbacks are falsely marked as class-switch swaps"
    source: gsd-code-fixer (0a59df32)
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "Encoded Claude App class requests never receive log SD surfaces"
    source: gsd-code-fixer (2e7a28da)
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Secret-bearing provider configuration crosses the notice boundary despite the scalar-only contract"
    source: gsd-code-fixer (75e027fd)
  - id: IN-01
    severity: info
    disposition: skipped
    title: "`servedModel` is a dead, potentially divergent input"
    source: out of scope (critical_warning fix scope) — subsumed by the WR-05 DTO rebuild that removed servedModel
open: 0
total: 11
recorded: 2026-11-15T15:30:00.000Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | gsd-code-fixer (1aae6177) |
| CR-02 | critical | fixed | gsd-code-fixer (eacadcf2) |
| CR-03 | critical | fixed | gsd-code-fixer (745e2222) |
| CR-04 | critical | fixed | gsd-code-fixer (6fbbf233) |
| CR-05 | critical | fixed | gsd-code-fixer (13542a5a) |
| WR-01 | warning | fixed | gsd-code-fixer (8f0c9d1d) |
| WR-02 | warning | fixed | gsd-code-fixer (831e5059) |
| WR-03 | warning | fixed | gsd-code-fixer (0a59df32) |
| WR-04 | warning | fixed | gsd-code-fixer (2e7a28da) |
| WR-05 | warning | fixed | gsd-code-fixer (75e027fd) |
| IN-01 | info | skipped | out of scope — subsumed by the WR-05 DTO rebuild |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.

Reconciled 2026-11-15 after fix iteration 1 (10/10 in-scope fixed; no re-review loop needed —
final suite green at 13542a5a: core 1012/0 fail, UI 131/131, electron 45/45).

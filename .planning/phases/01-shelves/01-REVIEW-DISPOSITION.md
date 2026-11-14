---
phase: "01"
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Failed score GET clears previous scores and can empty a shelf"
  - id: CR-02
    severity: critical
    disposition: open
    title: "Catalog refresh never applies the non-text output rules"
  - id: CR-03
    severity: critical
    disposition: open
    title: "Desktop startup never seeds or refreshes shelves"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The catalog walk keeps the startup config object"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Three tier tokens can shelf or review depending on token order"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Overlay updates the window number and leaves the capability flags"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A permitted class name can be sent to a model the profile did not allow"
  - id: WR-05
    severity: warning
    disposition: open
    title: "A null excluded or review entry crashes model discovery"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Impossible-state guard — score class cannot be missing"
  - id: IN-01
    severity: info
    disposition: open
    title: "Snapshot window lookup is case-sensitive"
open: 10
total: 10
recorded: 2026-11-14T17:45:00.000Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| CR-03 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.

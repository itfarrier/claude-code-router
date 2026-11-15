---
phase: "01"
review: 01-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Failed score GET clears previous scores and can empty a shelf"
    source: gsd-code-fixer
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Catalog refresh never applies the non-text output rules"
    source: gsd-code-fixer
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "Desktop startup never seeds or refreshes shelves"
    source: gsd-code-fixer
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "The catalog walk keeps the startup config object"
    source: gsd-code-fixer
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "Three tier tokens can shelf or review depending on token order"
    source: gsd-code-fixer
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Overlay updates the window number and leaves the capability flags"
    source: gsd-code-fixer
  - id: WR-04
    severity: warning
    disposition: open
    title: "A permitted class name can be sent to a model the profile did not allow"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "A null excluded or review entry crashes model discovery"
    source: gsd-code-fixer
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "Impossible-state guard — score class cannot be missing"
    source: gsd-code-fixer
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "A config save during a shelf refresh keeps the older snapshot"
    source: gsd-code-fixer
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "A failed shelf refresh drops the follow-up the config save requested"
    source: gsd-code-fixer
  - id: IN-01
    severity: info
    disposition: open
    title: "Snapshot window lookup is case-sensitive"
open: 2
total: 12
recorded: 2026-11-14T17:45:00.000Z
updated: 2026-11-14T21:35:00.000Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | gsd-code-fixer |
| CR-02 | critical | fixed | gsd-code-fixer |
| CR-03 | critical | fixed | gsd-code-fixer |
| WR-01 | warning | fixed | gsd-code-fixer |
| WR-02 | warning | fixed | gsd-code-fixer |
| WR-03 | warning | fixed | gsd-code-fixer |
| WR-04 | warning | open | — |
| WR-05 | warning | fixed | gsd-code-fixer |
| WR-06 | warning | fixed | gsd-code-fixer |
| WR-07 | warning | fixed | gsd-code-fixer |
| WR-08 | warning | fixed | gsd-code-fixer |
| IN-01 | info | open | — |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.
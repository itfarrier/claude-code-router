---
phase: "02"
review: 02-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "A stopped class refusal is forwarded with an empty body"
    source: gsd-code-fixer (0704923d)
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "One parked credential removes the whole model"
    source: gsd-code-fixer (ae61ad04)
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "The sent-slug set skips the next triple"
    source: gsd-code-fixer (ae86286f)
  - id: CR-04
    severity: critical
    disposition: fixed
    title: "Shelf planning identifies credentials by the filtered-list index"
    source: gsd-code-fixer (f97799c3)
  - id: CR-05
    severity: critical
    disposition: fixed
    title: "requestFacts throws when metadata is absent, and the gateway drops tool filtering"
    source: gsd-code-fixer (16d73577)
  - id: CR-06
    severity: critical
    disposition: fixed
    title: "Image lift is applied only to the first model"
    source: gsd-code-fixer (2cad90e0)
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "A Groq duration with no minutes is parked for 60 seconds"
    source: gsd-code-fixer (1e75b8af)
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "A 403 with no clock stays in the live set"
    source: gsd-code-fixer (8c113244)
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "A class network error is stored twice, and the trace records a backoff"
    source: gsd-code-fixer (0656be36)
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "A 2xx updates the bench only when a session id exists"
    source: gsd-code-fixer (dfc7f0d4)
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "The probe tick ignores the saved bench until something else loads it"
    source: gsd-code-fixer (950de82a)
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "Probe tick fix-key guard read a nonexistent credential property (introduced+fixed in auto loop)"
    source: gsd-code-fixer (b11f731b)
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "Bench-record throw between fetch and store leaked the response body (introduced+fixed in auto loop)"
    source: gsd-code-fixer (2ad8d65d)
  - id: IN-01
    severity: info
    disposition: skipped
    title: "The 400 check in the continue helper never runs"
    source: out of scope (critical_warning fix scope)
open: 0
total: 14
recorded: 2026-11-14T21:25:00.000Z
updated: 2026-11-15T01:10:00.000Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | gsd-code-fixer (0704923d) |
| CR-02 | critical | fixed | gsd-code-fixer (ae61ad04) |
| CR-03 | critical | fixed | gsd-code-fixer (ae86286f) |
| CR-04 | critical | fixed | gsd-code-fixer (f97799c3) |
| CR-05 | critical | fixed | gsd-code-fixer (16d73577) |
| CR-06 | critical | fixed | gsd-code-fixer (2cad90e0) |
| WR-01 | warning | fixed | gsd-code-fixer (1e75b8af) |
| WR-02 | warning | fixed | gsd-code-fixer (8c113244) |
| WR-03 | warning | fixed | gsd-code-fixer (0656be36) |
| WR-04 | warning | fixed | gsd-code-fixer (dfc7f0d4) |
| WR-05 | warning | fixed | gsd-code-fixer (950de82a) |
| WR-06 | warning | fixed | gsd-code-fixer (b11f731b) |
| WR-07 | warning | fixed | gsd-code-fixer (2ad8d65d) |
| IN-01 | info | skipped | out of scope (critical_warning fix scope) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.

Reconciled 2026-11-15 after the converged --auto loop (3 iterations, final review status: clean).

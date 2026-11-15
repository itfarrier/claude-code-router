---
phase: "02"
slug: "live-choice"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Claude request body → class policy | The policy must see scalars (model name, tool list, image flag, token estimate, tool-turn flag, session id) — never the message body. | Chat body — prohibited input |
| Provider responses → bench clocks | Refusal responses decide park times; a mis-parsed clock parks or frees credentials wrongly. | Untrusted headers and JSON fields |
| Bench file + logs → disk/console | Leg lines and bench rows must not carry provider keys. | Credential slugs (safe), API keys (prohibited) |
| tool_result content → class attempts | Image blocks inside tool_result are lifted to the parent user content for class requests only. | Image data (sanctioned), body (prohibited to policy) |
| Tool-turn map → process memory | Session-scoped triple memory lives in process RAM only. | Provider, credential id, model (not the body) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information disclosure | attemptsForClass | high | mitigate | Third argument is the scalar bag only; no body/messages/headers parameter exists (plan.ts:356-360, seam.ts:36-47). Human-validated 2026-11-15 (UAT P1). | closed |
| T-02-02 | Tampering | attemptsForClass | medium | mitigate | Empty live list returns undefined; `applyShelf` returns the parent plan; no lower-class append anywhere (plan.ts:377-420). Human-validated 2026-11-15 (UAT P3). | closed |
| T-02-03 | Tampering | recordClassRefusal | high | mitigate | Clock from headers (`retry-after`, bench.ts:295-297) and exact JSON keys (`next_flush_time`/`resets_at`, bench.ts:235) only; never `error.message`; 400 writes no row (test: `400 writes no bench row`). | closed |
| T-02-04 | Denial of service | recordClassRefusal | high | mitigate | 429 parks that credential on that model until the parsed clock, else 60000 ms (`bench429NoClockMs`, bench.ts:19); next choice skips the row (test: `retry-after seconds park that credential on that model`). | closed |
| T-02-05 | Elevation of privilege | startBench | high | mitigate | 403 with no time sets `probe: false`; `shouldProbeRow` skips it (bench.ts:652-654) and the tick's fix-key guard skips probe:false+no-until rows under the real slug (bench.ts:731-733, b11f731b). Human-validated 2026-11-15 (UAT P2). | closed |
| T-02-06 | Information disclosure | bench file and console.info | high | mitigate | Store and log the credential slug only (bench.ts:407); no provider key in bench file or leg lines (tests: `a failed class leg omits the provider key`, fixture-key-absence assertions). | closed |
| T-02-07 | Tampering | liftToolResultImages | high | mitigate | Image/`image_url`/`input_image` blocks move out of `tool_result` onto the parent user content; body copied before the edit; invoked only for class requests (plan.ts:405+, seam.ts:200; test: `the lifted tool_result image reaches the next shelf model`; CR-06 fix applies the lifted body to every attempt). | closed |
| T-02-08 | Information disclosure | tool-turn map | low | accept | `toolTurnBySession` stores only {credentialId, model, provider} (`RememberedTriple`, plan.ts); never the message body; a restart clears it (documented shortcut). | closed |
| T-02-09 | Tampering | prepareUpstreamCredentialAttempt | high | mitigate | Class attempt sets both target headers to the single first live credential not benched and not in the request-local sent set (per-triple sent slug, executor.ts:537-542 post-CR-03); no credential → continue before fetch, headers deleted (executor.ts:214-215); 400 stops the loop, writes no bench row (test: `a class attempt sends one credential`). | closed |
| T-02-10 | Information disclosure | console.info leg line | high | mitigate | Leg line logs slug, status, provider, model only; no key or authorization header (test-enforced: fixture-key absence + no-recordUsage assertion). Human-validated 2026-11-15 (UAT P4). | closed |
| T-02-11 | Denial of service | recordProviderCredentialOutcome call sites | medium | mitigate | Both call sites skip when `isClassAttempt` is true (executor.ts:758, pipeline.ts:907), so a class 5xx is servable again after the bench's 30000 ms park. | closed |
| T-02-12 | Tampering | fetchUpstreamWithFallback | low | accept | Status 402, 408, 409, and network errors try the next row, write no bench row, and skip the sent slug; the locked table names no park for them. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-02-08 | T-02-08 | Tool-turn map is process memory holding the triple (provider, credential id, model) only — no message content; restart clears it by design. | User (plan-authored disposition) | 2026-11-14 |
| T-02-12 | T-02-12 | 402/408/409/network errors rotate without parking; the locked source-chat table names no park for them. | User (plan-authored disposition) | 2026-11-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 12 | 12 | 0 | autonomous run (L1 grep verification; register authored at plan time; ASVS L1 short-circuit; post 13-fix review loop) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15

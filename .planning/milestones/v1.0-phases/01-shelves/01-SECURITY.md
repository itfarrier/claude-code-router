---
phase: "01"
slug: "shelves"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Claude request model string → `createRouteExecutionPlan` | The model name is untrusted and decides whether traffic leaves the parent attempt list. | Untrusted model-name string |
| Snapshot file → request path | A local file can be edited between the writer and the reader. | Local JSON snapshot (model ids, scores, windows) |
| Shelf opener → logs | The request can carry a message body and credentials that this path must not touch. | Chat body, tool results, images, credentials — prohibited input |
| Provider model id + OpenRouter JSON → `classifyModel` | Ids and index values are untrusted; a bad value must not change the process or pick a class by accident. | Untrusted ids and numeric indexes |
| OpenRouter + provider model-list HTTP → snapshot | Responses are untrusted and must not spend a chat completion or capture a key. | Untrusted HTTP responses, provider API keys |
| Snapshot writer → disk | A partial write must not replace a good snapshot with a short file. | Cache-directory file writes |
| Models response → Claude Code | A made-up window would make Claude treat a model as a size it does not have. | Context-window integers |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Spoofing | parseClassRequest | high | mitigate | Whole trimmed-string match; a following ASCII letter/digit does not open the class (`claude-opusplan`, `best-model` stay on the parent plan). Tests: `locked class families open their shelves`, `opusplan best-model and bare opus keep the parent attempt list`. | closed |
| T-01-02 | Tampering | readShelfSnapshot | medium | mitigate | Accepts only the ShelfSnapshot field shape (`isRecord` guards); missing/unreadable/invalid file returns undefined and `applyShelf` keeps the parent plan. | closed |
| T-01-03 | Information disclosure | applyShelf | high | mitigate | Arguments are the parent plan and the execution-plan input only; no message body read, no credentials in snapshot or logs. Human-validated 2026-11-14 (UAT item 1, narrowed: shelf-open half superseded by sanctioned phase-2 policy input). | closed |
| T-01-04 | Tampering | classifyModel | medium | mitigate | Index counted only with `Number.isFinite` (catalog.ts:90, :401); unknown JSON keys ignored; model id never evaluated as code. | closed |
| T-01-05 | Spoofing | classifyModel tier tokens | medium | mitigate | Whole-token compare via `modelIdTokens` + `tierClassForToken`; `IGNORED_TIER_TOKENS` — `console` is not opus, `batcher` is not batch. | closed |
| T-01-06 | Denial of service | refreshClassShelves | high | mitigate | Probe called with `mode: "models"` only (catalog.ts:812); tests reject `mode: connectivity` and a chat ping body. | closed |
| T-01-07 | Information disclosure | refreshClassShelves score GET | high | mitigate | Snapshot stores provider/model/score/tier/window/reason only. Authorization header attached only on the 401 retry (catalog.ts:701, :707) and only when the provider host is `openrouter.ai` (catalog.ts:661); header never logged. Human-validated 2026-11-14 (UAT item 3). | closed |
| T-01-08 | Denial of service | refreshClassShelves | medium | mitigate | Failed provider list keeps that provider's previous rows; failed score GET keeps previous scores (explicit prior-row preservation). Test: `catalog refresh drops a missing model and keeps a failed provider`. | closed |
| T-01-09 | Tampering | writeShelfSnapshot | medium | mitigate | Temp file in cache dir (`${file}.${randomUUID()}.tmp`) then `rename` over the snapshot (catalog.ts:924–930). | closed |
| T-01-10 | Information disclosure | class-switch-shelves.json | low | accept | File holds model ids in the same user-data directory as the existing models cache; model ids are not credentials; the key stays out of the file under T-01-07. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| T-01-10 | T-01-10 | Model ids in `class-switch-shelves.json` are not credentials and live in the same user-data directory as the existing models cache; the API key is excluded by T-01-07's mitigation. | User (plan-authored disposition) | 2026-11-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 10 | 10 | 0 | autonomous run (L1 grep verification; register authored at plan time; ASVS L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15

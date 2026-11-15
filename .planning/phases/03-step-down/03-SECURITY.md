---
phase: "03"
slug: "step-down"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-15"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Claude request → attemptsForStepDown | Only the model name and existing scalar facts cross; message content and credentials do not. | Model name + scalar bag (toolNames, hasImage, token estimate, tool-turn flag, session id) — non-secret |
| Final provider attempt → notice + response headers | Actual route metadata becomes operator-visible; spoofed upstream header values and raw secrets must not cross. | Route metadata (model, provider, credential slug, fixed reason) — slug only, never the key |
| Shelf/bench state → notice recovery | A stale record must not survive a live requested class, and a read must not mutate routing order. | Class liveness facts — non-secret |
| Browser → POST /api/ccr/rpc | The existing x-ccr-web-auth check runs before notice data is returned. | Zero-argument read result — slug-bearing SwapNotice only |
| Renderer → Electron preload/IPC | Only a zero-argument read crosses contextIsolation; no provider credential or request body is accepted. | SwapNotice record — read-only |
| Core notice → either transport | The same safe SwapNotice record crosses; transport code must not mutate or persist it. | SwapNotice — validated shape |
| RPC notice → React markup | Model, provider, credential label, and reason are untrusted display strings and must remain text, not markup. | Display strings — React text nodes only |
| Existing request log → SD derivation | Missing or inconsistent fields must suppress the indicator rather than fabricate a swap. | Paired x-ccr-* header evidence — derivation only |
| Notice state → aliveness signal | A manual dismissal or stale record would mislead the user about class health. | Recovery facts only |
| Actual SwapNotice → routeTrace observer | Only the fixed routing reason from a non-null actual lower-class swap crosses into the decision hop; provider errors, bodies, and credentials must not cross. | One scalar reason string |
| Persisted production entry → UI fixture | The cross-package test projection excludes secret-bearing log fields and normalizes only volatile values, never inventing a decision. | Scalar fields + routeTrace — no bodies/requestHeaders/credentialChain |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Information disclosure | attemptsForStepDown + recordStepDownSuccess | high | mitigate | Scalar-only planner signature `attemptsForStepDown(parsed, modelRegistry, scalars?)` (plan.ts:463-468); scalar DTO across the notice boundary (`recordStepDownSuccessFromTarget`, seam.ts:228); named test "recorded notices never carry the credential secret or request text" (step-down.test.mjs:1051); WR-05 regression asserts no object-valued field/secret path | closed |
| T-03-02 | Tampering | attemptsForStepDown ordering | high | mitigate | Requested-class priority plus strict `SHELF_CLASS_RANK = ["fable","opus","sonnet","haiku"]` ordering from one request-local list (plan.ts:324); class-priority and all-class-exhaustion transitions covered by plan.test.mjs + step-down.test.mjs (architecture gate 5/5 upholds FORK-SEAMS boundaries) | closed |
| T-03-03 | Tampering | pipeline response headers | high | mitigate | Both x-ccr headers deleted then set together only from the actual lower-class 2xx, gated on the kill switch (CR-03 fix: with CCR_CLASS_SWITCH=0 upstream headers forward unchanged, exact parent behavior); forged upstream header values tested (step-down.test.mjs:461-462, 483-484) | closed |
| T-03-04 | Information disclosure | SwapNotice + request-log values | high | mitigate | Notice stores only credential slug, fixed routing reasons, model/provider labels — no body or arbitrary provider error text; RequestLogEntry schema unchanged; secret/request-text absence asserted (step-down.test.mjs:1051); production fixture excludes bodies/requestHeaders/credentialChain | closed |
| T-03-05 | Information disclosure | management RPC + Electron notice reads | high | mitigate | Transports return only the SwapNotice created in plan 03-01: zero-argument `getSwapNotice` → `gatewayService.readSwapNotice()` (management-server.ts:345; ipc.ts:129); no payload accepting a key, body, or arbitrary reason exists | closed |
| T-03-06 | Elevation of privilege | rpcHandlers.getSwapNotice | high | mitigate | Registered only inside the existing authenticated /api/ccr/rpc dispatcher (management-server.ts:345); invalid-token 401 tests cover the dispatcher (web-management-server.test.mjs:237-253); no standalone route or write method (prohibition 2a signed off in 03-UAT.md) | closed |
| T-03-07 | Tampering | desktop/web bridge parity | medium | mitigate | One channel name `ccr:app:get-swap-notice` (ipc-channels.ts:27) and one seam read across ipc.ts:129, preload.ts:141, electron.d.ts:129, web-client-bridge.ts:139; parity enforced by electron swap-notice-ipc tests (45/45) and the web-client-bridge integration test | closed |
| T-03-08 | Information disclosure | SwapNoticeBanner + LogExpandedDetails (SD) | high | mitigate | Swap surfaces render only credentialLabel slugs and approved routing fields (banner layout.tsx:528-533; SD block derives from paired x-ccr-* header evidence, network-logs.tsx:1627-1628); component tests assert fixture keys and message markers absent from the swap surfaces; credentialChain appears only in the parent's pre-existing log detail, never in notice/SD markup | closed |
| T-03-09 | Tampering | provider/model/reason rendering | medium | mitigate | React text nodes + t() templates only — `dangerouslySetInnerHTML` count in packages/ui/src is 0; SD derived only from strict known class tokens; missing/non-class/inconsistent data renders nothing (network-logs.tsx:1523; WR-03 regressions for header-less and contradictory evidence) | closed |
| T-03-10 | Tampering | banner dismissal + polling | medium | mitigate | No close/dismiss control exists in SwapNoticeBanner (layout.tsx:495-543 — zero button elements); removal only via backend recovery reconciliation; the notice read rides the existing `startVisiblePolling(…, 2000)` cycle with a nonfatal catch rendering no banner on failure (App.tsx:383-392) — no second timer | closed |
| T-03-11 | Information disclosure | routeTrace capture + production log fixture | high | mitigate | Capture crosses only `SwapNotice.reason` from the non-null actual record, exactly one marked decision per swap (seam.ts:251-259, 03-04); fixture projects only UI-consumed scalar fields + routeTrace, excluding bodies/requestHeaders/credentialChain (step-down.test.mjs:1170), with secret/request-marker non-disclosure assertions retained and sha256-stable fixture | closed |
| T-03-12 | Tampering | Reason selection in LogExpandedDetails | medium | mitigate | Exactly one explicitly marked class-switch decision per actual swap; the UI test uses the production-generated trace and asserts the real `fallback:off` execution-plan reason neither replaces Reason nor appears when class-switch hops are removed (WR-02 selector untouched — network-logs.tsx unmodified by 03-04) | closed |
| T-03-SC | Tampering | npm/pip/cargo installs (supply chain) | high | mitigate | No install planned and none performed: `git log 4f3c6112..HEAD` touches no package.json; RESEARCH.md Package Legitimacy Audit empty by design; the legitimacy gate + blocking human checkpoint for any newly proposed package was never triggered (attested in all four plans) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| — | — | No accepted risks. | — | — |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-15 | 13 | 13 | 0 | orchestrator (gsd-secure-phase State B, L1 grep verification; register authored at plan time; ASVS L1 short-circuit — no auditor spawn required) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-15 (autonomous orchestrator run; L1 grep-depth sufficient at ASVS level 1 with zero open threats)

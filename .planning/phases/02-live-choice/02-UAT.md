---
status: testing
phase: 02-live-choice
source: [02-VERIFICATION.md]
started: 2026-11-15T01:00:00Z
updated: 2026-11-15T01:00:00Z
---

## Current Test

number: 1
name: Prohibition sign-off P1 — confirm the class policy never receives the message body. Inspect attemptsForClass(plan.ts) and RouteExecutionPlanInput(seam.ts): the only inputs are the parsed class, the registry, and the scalar bag (toolNames, hasImage, estimatedTokens, toolTurn, sessionId); requestFacts reduces the body to scalars and returns none of the body.
expected: |
  No body/messages/headers parameter exists on the policy path; the policy input is the model name, tool list, image flag, token estimate, tool-turn flag, and session id only. Accept or reject the prohibition.
awaiting: user response

## Tests

### 1. Prohibition sign-off P1 — the class policy never receives the message body
expected: No body/messages/headers parameter exists on the policy path; the policy input is the model name, tool list, image flag, token estimate, tool-turn flag, and session id only. Accept or reject the prohibition.
result: [pending]

### 2. Prohibition sign-off P2 — a fix-key credential is never probed
expected: One fix-key log line for that credential and no connectivity probe against it (shouldProbeRow and the probe tick both skip probe:false rows with no until). Run CCR for several minutes with a provider credential that returns 403 with no clock and watch the logs.
result: [pending]

### 3. Prohibition sign-off P3 — an empty shelf is never answered with a lower class in this phase
expected: The requested class name is still the attempt (parent behavior); no Sonnet/Haiku model silently serves the Opus request before Phase 3 lands. Park every model on a class shelf and send that class request.
result: [pending]

### 4. Prohibition sign-off P4 — a failed class leg is not counted as the user request on the success card
expected: The card counts the one user request; the failed leg appears only as its own [class-switch] leg line, with the credential slug and no API key. Send a class request whose first leg fails (429) and whose second leg succeeds; check the request log and success card.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

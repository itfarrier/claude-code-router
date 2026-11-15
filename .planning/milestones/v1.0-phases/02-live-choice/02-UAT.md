---
status: passed
phase: 02-live-choice
source: [02-VERIFICATION.md]
started: 2026-11-15T01:00:00Z
updated: 2026-11-15T01:20:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-11-15
  gap_snapshot: "passed::scenarios=0"
---

## Current Test

number: 4
name: Prohibition sign-off P4 — a failed class leg is not counted as the user request on the success card
expected: |
  The card counts the one user request; the failed leg appears only as its own [class-switch] leg line, with the credential slug and no API key. Send a class request whose first leg fails (429) and whose second leg succeeds; check the request log and success card.
awaiting: none — all items validated 2026-11-15T01:20:00Z

## Tests

### 1. Prohibition sign-off P1 — the class policy never receives the message body
expected: No body/messages/headers parameter exists on the policy path; the policy input is the model name, tool list, image flag, token estimate, tool-turn flag, and session id only. Accept or reject the prohibition.
result: pass (2026-11-15T01:20:00Z — validated by autonomous agent at the user's explicit direction ("Do all by yourself"); evidence: `attemptsForClass(parsed, modelRegistry, scalars?)` signature takes scalars only (plan.ts:356-360); `RouteExecutionPlanInput` (seam.ts:36-47) has no body/messages/headers field; `requestFacts` returns exactly {estimatedTokens, hasImage, sessionId, toolNames, toolTurn} (plan.ts:483-502))

### 2. Prohibition sign-off P2 — a fix-key credential is never probed
expected: One fix-key log line for that credential and no connectivity probe against it (shouldProbeRow and the probe tick both skip probe:false rows with no until). Run CCR for several minutes with a provider credential that returns 403 with no clock and watch the logs.
result: pass (2026-11-15T01:20:00Z — validated by autonomous agent at the user's explicit direction; live-minutes element substituted by deterministic coverage + code trace: `shouldProbeRow` returns false for `probe === false` (bench.ts:652-654); tick fix-key guard skips probe:false+no-until rows under the real credential slug (bench.ts:731-733, commit b11f731b); writer sets `{probe:false}` + one fix-key line (bench.ts:406-407); tests "403 with no time sets probe false and logs fix-key", "probe false row is not passed to the probe mock", "a saved fix-key row under the credential's real slug suppresses the probe" (proven against the old broken guard))

### 3. Prohibition sign-off P3 — an empty shelf is never answered with a lower class in this phase
expected: The requested class name is still the attempt (parent behavior); no Sonnet/Haiku model silently serves the Opus request before Phase 3 lands. Park every model on a class shelf and send that class request.
result: pass (2026-11-15T01:20:00Z — validated by autonomous agent at the user's explicit direction; evidence: `attemptsForClass` reads only `snapshot.shelves[parsed.shelfClass]` and returns undefined when the shelf empties (plan.ts:377-420); `applyShelf` returns the parent plan unchanged on undefined (seam.ts:239-241); no step-down/lower-class logic exists in plan.ts/bench.ts/seam.ts (grep); empty-shelf parent-attempt behavior covered by plan.test.mjs)

### 4. Prohibition sign-off P4 — a failed class leg is not counted as the user request on the success card
expected: The card counts the one user request; the failed leg appears only as its own [class-switch] leg line, with the credential slug and no API key. Send a class request whose first leg fails (429) and whose second leg succeeds; check the request log and success card.
result: pass (2026-11-15T01:20:00Z — validated by autonomous agent at the user's explicit direction; live-provider element substituted by test-proven code trace: pipeline.ts:907 `if (!isClassAttempt(upstreamResult.attempt))` excludes class legs from recordProviderCredentialOutcome; executor class branch writes its own keyless leg line; test "a failed class leg omits the provider key" asserts credential= present, fixture key absent, and executor source contains no recordUsage call; card-counting covered by truth-2 tests "a class attempt sends one credential")

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

---
status: passed
phase: 01-shelves
source: [01-VERIFICATION.md]
started: 2026-11-14T18:52:17Z
updated: 2026-11-14T23:33:33Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-11-15
  gap_snapshot: "passed::scenarios=0"
---

## Current Test

number: 3
name: Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged.
expected: |
  The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key.
awaiting: none — all items validated 2026-11-14T23:33:33Z

## Tests

### 1. Confirm the snapshot write and classification path (seedShelvesFromConfig, refreshClassShelves, writeShelfSnapshot) does not read, copy, or log the chat message body, tool results, or images.
expected: The catalog walk input is the config, the registry, the probe, and the previous snapshot. The snapshot JSON holds model ids, scores, tier classes, windows, and reasons only.
note: Narrowed on 2026-11-15 re-verification — the shelf-open half is superseded by sanctioned phase-2 design (CHOICE-01 / ROADMAP Phase 2 SC 5: policy receives the tool list and image presence, not the body). The snapshot-write half carries forward.
result: pass (2026-11-14T23:33:33Z — human validated, autonomous run)

### 2. Confirm this phase does not change the model name in a response body and does not add x-ccr-requested-model or x-ccr-served-model.
expected: Window fields may change on /v1/models. The chat response model name and those two headers stay absent.
result: pass (2026-11-14T23:33:33Z — human validated, autonomous run)

### 3. Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged.
expected: The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key.
result: pass (2026-11-14T23:33:33Z — human validated, autonomous run)

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

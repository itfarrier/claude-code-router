---
status: testing
phase: 01-shelves
source: [01-VERIFICATION.md]
started: 2026-11-14T18:52:17Z
updated: 2026-11-14T18:52:17Z
---

## Current Test

number: 1
name: Confirm a shelf open and a snapshot write do not read, copy, or log the chat message body, tool results, or images.
expected: |
  The shelf input stays the model name, the registry, and the snapshot.
awaiting: user response

## Tests

### 1. Confirm a shelf open and a snapshot write do not read, copy, or log the chat message body, tool results, or images.
expected: The shelf input stays the model name, the registry, and the snapshot.
result: [pending]

### 2. Confirm this phase does not change the model name in a response body and does not add x-ccr-requested-model or x-ccr-served-model.
expected: Window fields may change on /v1/models. The chat response model name and those two headers stay absent.
result: [pending]

### 3. Confirm the OpenRouter models GET sends a provider API key only after an unauthenticated 401, and only when that provider host is openrouter.ai, and that the key is not stored or logged.
expected: The first GET has no authorization header. A 401 retries with an openrouter.ai key. The snapshot JSON has no key.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

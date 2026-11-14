---
phase: 02-live-choice
reviewed: 2026-11-14T21:19:07Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - packages/core/src/class-switch/bench.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/gateway/model-catalog.ts
  - packages/core/src/gateway/request/pipeline.ts
  - packages/core/src/gateway/upstream/executor.ts
  - packages/core/src/routing/execution-plan.ts
  - packages/core/test/unit/class-switch/bench.test.mjs
  - packages/core/test/unit/class-switch/choice.test.mjs
findings:
  critical: 6
  warning: 5
  info: 1
  total: 12
  necessity: 0
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-11-14T21:19:07Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

A class request can leave the strongest live triple untried, and a refusal that stops the loop is returned with an empty body.

The diff does keep the locked boundaries. `UpstreamAttempt` has no new field. `credential-pool.ts` and `catalog.ts` are untouched. `notice.ts` and step-down are absent. A marked class attempt is one credential, a class 400 writes no bench row, and `recordProviderCredentialOutcome` is skipped for that attempt. `attemptsForClass` receives scalars, not the message body. The failed-leg line logs the credential slug, not the provider key.

Those checks do not hold the serving path together. One credential park hides every other credential on that model. The request-local sent set is a bare slug, so the next model or the next provider is skipped. A class 400, and the last continued refusal, cancel or drain the upstream body before the pipeline forwards it.

## Critical Issues

### CR-01: A stopped class refusal is forwarded with an empty body

**File:** `packages/core/src/gateway/upstream/executor.ts:576-681`
**Issue:** On a class 400 the loop cancels the upstream body and then returns that same `Response`. On 401, 402, 403, 404, 408, 409, 429, and 5xx it does the same when the loop stops: `response.text()` runs when `shouldBufferAggregateErrorBody` is true, then `cancelResponseBody` runs, then the drained `Response` is returned (including `lastClassFailureResponse` after later rows are skipped). `proxyRequest` reads that body again (`pipeline.ts` buffers JSON errors, otherwise pipes the stream). The second read throws or the stream errors, and the client gets the status with no error payload. A shape 400 is the case that must stop and still explain why.
**Fix:** Cancel the body only when another row will be fetched. When the loop returns the response, forward a body that is still readable. If the bench path already consumed the JSON, build a new `Response` from that text.

```ts
if (response.status === 400) {
  return { attempt, failedAttempts, response, timing: { attemptStartedAtMonoMs } };
}

let forwarded = response;
if (classWritesBenchRow(response.status) && modelParts && shouldBufferAggregateErrorBody(response.headers)) {
  const raw = await response.text().catch(() => "");
  forwarded = new Response(raw, { headers: response.headers, status: response.status });
  // pass JSON.parse(raw) into recordClassRefusal when it parses
}
if (continueClass && hasNextAttempt) {
  if (forwarded === response) void cancelResponseBody(response);
  continue;
}
return { attempt, failedAttempts, response: forwarded, timing: { attemptStartedAtMonoMs } };
```

### CR-02: One parked credential removes the whole model

**File:** `packages/core/src/class-switch/plan.ts:377`
**Issue:** `attemptsForClass` drops a shelf row with `isBenched(provider, model)` and no credential id. `isBenched` treats a missing credential id as a match for every row (`bench.ts:529`: `credentialId === undefined`). A 429 stored for one credential therefore removes the model, so a second live credential on that model is never planned. A 401 is stored as that credential on model `*`, so the same call removes every shelf row for that provider. `hasLiveCredential` already checks each slug, but it never runs for those rows. The next class request does not serve the strongest triple that is still live.
**Fix:** Match an omitted credential id only to a wildcard credential row (`*`), which is the 404 and 5xx scope. Keep the per-slug checks in `hasLiveCredential` and `buildAttempts`.

```ts
if (rowCredential === "*" || (credentialId !== undefined && rowCredential === credentialId)) {
  return true;
}
```

### CR-03: The sent-slug set skips the next triple

**File:** `packages/core/src/gateway/upstream/executor.ts:522-524`
**Issue:** Before the fetch, the class loop adds `attempt.credentialIds[0]` to a request-local set. `prepareUpstreamCredentialAttempt` then drops every later row with that slug (`executor.ts:886-887`). The slug is not tied to a provider or a model. `providerCredentialRuntimeId` defaults to `key-1` for the first credential of every provider, so a 429 from provider A skips provider B's only key. The same skip blocks the next shelf model when it uses the credential that just failed. A 429 is per credential and model; the next model is a different triple and is never fetched. The loop then returns the first refusal.
**Fix:** Key the set by provider, model, and slug. A later row with the same slug on another model, or the same slug on another provider, stays eligible. Rows for the same model still move to the next credential.

```ts
const parts = classAttemptModelParts(attempt);
const slug = attempt.credentialIds?.[0];
if (classLive && parts && slug) {
  sentCredentialSlugs.add(`${parts.provider}\0${parts.model}\0${slug}`);
}
// filter: sentCredentialSlugs.has(`${providerName}\0${modelId}\0${slug}`)
```

### CR-04: Shelf planning identifies credentials by the filtered-list index

**File:** `packages/core/src/class-switch/plan.ts:150-152`
**Issue:** `hasLiveCredential`, `buildAttempts` (`plan.ts:294`), and `toolTurnAttempt` (`plan.ts:335-337`) pass the index inside `activeProviderCredentials` to `providerCredentialRuntimeId`. That helper uses the passed index for the default id (`key-1`, `key-2`, or `name-N`) and ignores `credentials.indexOf` when an index is passed. `activeProviderCredentials` drops disabled credentials and credentials with no api key, so the filtered index is not the configured index. The executor records and filters with `credentials.indexOf` (`executor.ts:881-882`). After a 429 the bench key is `key-2`, while the shelf still looks up `key-1`. The live credential stays in the plan, the executor then drops it as benched, and a tool-turn memory of the real slug does not match, so the sticky row is not the one returned. A provider whose first credential is disabled can fail the next class request with no fetch.
**Fix:** Omit the index argument and let `providerCredentialRuntimeId` resolve the configured index. Use that same slug in the shelf filter and in the executor.

```ts
const slug = providerCredentialSlug(providerCredentialRuntimeId(provider, credential));
```

### CR-05: `requestFacts` throws when `metadata` is absent, and the gateway drops tool filtering

**File:** `packages/core/src/class-switch/plan.ts:487-490`
**Issue:** The session-id condition is `typeof isRecord(parsed.metadata) && typeof parsed.metadata.session_id === "string" && ...`. `typeof` applies only to `isRecord(...)`, which is the string `"boolean"` and is truthy. The next operand then reads `parsed.metadata.session_id`. When `metadata` is missing, that read throws `TypeError`. `buildUpstreamAttempts` catches it (`executor.ts:1437-1449`) and replaces the facts with token and image counts only. `toolNames` stays empty and `toolTurn` stays false. A normal class request with tools and no `metadata` object keeps a shelf row whose catalog `toolCalling` is false. That row can answer 400, and a class 400 does not try the next triple.
**Fix:** Test the object before reading `session_id`.

```ts
const metadata = parsed.metadata;
const sessionId =
  isRecord(metadata) && typeof metadata.session_id === "string" && metadata.session_id.trim()
    ? metadata.session_id.trim()
    : undefined;
```

### CR-06: Image lift is applied only to the first model

**File:** `packages/core/src/gateway/upstream/executor.ts:1482-1485`
**Issue:** `liftToolResultImages` runs once and the result is stored on `planningBody`. The attempt cache is seeded only for `attempts[0].model` (`executor.ts:360-367`). A later attempt whose model misses that cache rebuilds the body from the original `input.body` in `buildAttemptBody` (`executor.ts:1500-1520`). Images that were moved out of `tool_result` for the first model are still inside `tool_result` for the next model. A pre-token refusal on the first model can then draw a shape 400 from the next model, and the class loop stops.
**Fix:** Pass the lifted buffer into every `buildAttemptBody` call for that request.

```ts
const classBody = attemptBuild.planningBody ?? input.body;
const sourceBody = buildAttemptBody(classBody, input.path, plannedAttempt.model, { /* discount headers */ });
```

## Warnings

### WR-01: A Groq duration with no minutes is parked for 60 seconds

**File:** `packages/core/src/class-switch/bench.ts:139-149`
**Issue:** `parseGroqDurationMs` accepts only `(\d+)m([\d.]+)s`. `7.66s` does not match. `parseQuotaPair` then returns no clock, and a zero-remaining 429 or 2xx uses `now + 60000` (`bench.ts:449-450`). The credential is off the shelf for about a minute after the provider reset has passed. `bench.test.mjs` asserts `until > now + 7000` for `7.66s`, and the 60-second fallback also passes that assertion.
**Fix:** Accept an optional minute part. Do not `Date.parse` the string.

```ts
const match = /^(?:(\d+)m)?([\d.]+)s$/i.exec(value.trim());
if (!match) return undefined;
const minutes = Number(match[1] ?? 0);
const seconds = Number(match[2]);
if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
return now + minutes * 60_000 + seconds * 1000;
```

### WR-02: A 403 with no clock stays in the live set

**File:** `packages/core/src/class-switch/bench.ts:458-466`
**Issue:** A 403 with no provider clock stores `{ probe: false }` and no `until` (`bench.ts:400-403`). `rowActive` is true only when `until > now`, so `isBenched` is false. The probe timer skips the row, but `hasLiveCredential` and `prepareUpstreamCredentialAttempt` still select that credential. Every later class request spends a refusal on the key the bench told the operator to fix, then continues.
**Fix:** Treat `probe === false` with no `until` as parked for routing.

```ts
function rowActive(row: BenchRow | undefined, now: number): boolean {
  if (!row) return false;
  if (row.probe === false && row.until === undefined) return true;
  return typeof row.until === "number" && row.until > now;
}
```

### WR-03: A class network error is stored twice, and the trace records a backoff

**File:** `packages/core/src/gateway/upstream/executor.ts:746-791`
**Issue:** The `catch` block always calls `retryDelayAfterNetworkError` and pushes one `failedAttempts` entry with that delay (at least 1000 ms). For `classLive` it then pushes a second entry with `delayMs: 0` and continues without waiting. The route trace's `retryDelayMs` is the backoff value. `x-ccr-fallback-attempts` and `x-ccr-fallback-delays-ms` therefore show two failures and a delay the class loop did not use. The next fetch itself is not delayed.
**Fix:** For a class continuation, push one entry with `delayMs: 0`, do not call `retryDelayAfterNetworkError`, and record `retryDelayMs: 0` on the trace.

### WR-04: A 2xx updates the bench only when a session id exists

**File:** `packages/core/src/gateway/upstream/executor.ts:537-551`
**Issue:** `recordClassSuccess` and `remember` sit inside `if (sessionId && modelParts && attempt.credentialIds?.[0])`. A class 2xx with no session header and no `metadata.session_id` does not clear a park, does not store `confirmed` or the success duration, and does not park a credential whose remaining request or token count is 0. The next class request can select that empty credential again.
**Fix:** Call `recordClassSuccess` for every class 2xx that has a provider, model, and credential slug. Call `remember` only when `sessionId` is non-empty.

### WR-05: The probe tick ignores the saved bench until something else loads it

**File:** `packages/core/src/class-switch/bench.ts:672-679`
**Issue:** `runBenchProbeTick` never calls `loadBenchFromDisk`. After a restart the in-memory map stays empty until a request calls `isBenched` or `recordClassRefusal`. The first 30-second tick can send a connectivity probe for a credential whose saved row is `probe: false`. The tick also uses the first map entry whose key starts with the provider and ends with the model, not the row with the newest `sampledAt`, so the large-remainder skip can follow an older sample.
**Fix:** Call `loadBenchFromDisk` at the start of the tick. Choose the matching row with the greatest `sampledAt`.

## Info

### IN-01: The 400 check in the continue helper never runs

**File:** `packages/core/src/gateway/upstream/executor.ts:1379-1382`
**Issue:** `classShouldContinueAfterStatus` returns false for 400, but the class branch already returned on 400 before that call. The helper's 400 branch is dead. The statuses that follow do not include 400, so the early return does not change behavior.
**Fix:** Delete the 400 branch in `classShouldContinueAfterStatus`.

---

_Reviewed: 2026-11-14T21:19:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

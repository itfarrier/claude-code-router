# Phase 2: Live choice - Research

**Researched:** 2026-11-14
**Domain:** Live triple choice, bench, token rotation, quota headers, pre-token refusal
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

CONTEXT.md was generated with discuss skipped (`workflow.skip_discuss`). It has no locked implementation choices of its own. The product rules it points at are locked in `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/research/IMPORTED-DESIGN.md`, and `.planning/research/FORK-SEAMS.md`. Do not reopen those rules.

### Locked Decisions

Copied from `02-CONTEXT.md` `<decisions>`:

### Claude's Discretion

All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

The discretion items this research locks for the planner are in **Architecture Patterns** below. They are the smallest reading of the roadmap that the current code can implement. Do not add a second design.

### Deferred Ideas (OUT OF SCOPE)

Copied from `02-CONTEXT.md` `<deferred>`:

None — discuss phase skipped.

Also out of this phase, from the roadmap, from `.planning/research/FORK-SEAMS.md`, and from the phase brief:

- Step-down, the empty-shelf ladder, the swap notice, and headers `x-ccr-requested-model` / `x-ccr-served-model` (Phase 3). Do not append Sonnet or Haiku rows. Do not create `notice.ts`.
- A review-queue approve or reject screen. A disagreed model stays off the shelf (Phase 1).
- Edits to `credential-pool.ts`, `profiles/service.ts`, `config.ts`, or `CUSTOM_ROUTER_PATH`.
- A second policy call inside the request loop. The attempt list is built once.
- A field on `UpstreamAttempt` or on `Router.fallback`.
- A hard-coded free-tier requests-per-minute table. OpenRouter's published 20/50 free-model caps are not a CCR limiter.
- A new npm dependency.
- Replanning Phase 1 shelves. Human verification for Phase 1 was deferred. Use the shelf snapshot that Phase 1 already writes.

### Locked product rules the planner must implement

From `.planning/research/IMPORTED-DESIGN.md` and CHOICE-01, CHOICE-02, BENCH-01, BENCH-02, BACK-02, SAFE-01, SAFE-02:

- A triple is provider + token + model. One class name covers many triples on that shelf only.
- Filters, in order: benched, quota zero, tools or images the model cannot do, request longer than the model window.
- Sort by score, high to low. A model with no successful check ranks below a confirmed model of the same score. Remaining quota, then time-to-first-token, break a remaining tie. `provider` then `model` (`localeCompare`) is the last key. Phase 1 already sorts score, then provider, then model.
- Near-tied models get a thin share. The numbers are discretion, locked below.
- For the chosen model, take the next live token. A refusal before the first token drops that triple and takes the next row. After the response is committed, that triple stays for the rest of the tool turn. The next real user message chooses again.
- Bench, one table for all sessions, scopes from the source chat:

| What arrived | What sits | How long |
|---|---|---|
| 429 | this token on this model | until `Retry-After`, else `X-RateLimit-Reset`, else `next_flush_time` / `resets_at` |
| 401, no time | this token on every model of that provider | recheck every 5 minutes |
| 403 and `resets_at` is set | this token | until that time, no extra probe |
| 403 and `resets_at` is empty | this token | do not probe; tell the user to fix the key |
| 404 | this model on every token of that provider | 1 hour |
| 5xx | this model at this provider | 30 seconds |
| 400 from request shape | nobody | the next normal request may use it |

- Quota comes from that response. Do not parse `next_flush_time` out of free text.
- A model CCR might serve, with no fresh time, is probed within 1–2 minutes. If the provider already named a time, the next probe is that time. A large remaining quota skips the extra probe. A successful Claude turn clears that triple early.
- The policy receives the model name, the tool list, and whether an image is present. It returns parsed triples. It does not receive the message body.
- The success card counts the user request. A failed leg is its own log line, without the API key. The step-down notice is Phase 3. This phase's user-visible tell is the log line plus the bench record.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHOICE-01 | Serve the highest-scoring live triple that is not benched, has quota left, supports the request's tools and images, and fits the context. Unchecked ranks below a confirmed model of the same score. An image inside `tool_result` counts and survives protocol translation. Near-tied models get a thin share. | `plan.ts` filters the Phase 1 shelf and repeats each model once per live token. `estimateLimitUsage` supplies the image count and the token estimate. `liftToolResultImages` moves image blocks out of `tool_result` before the core gateway flattens them to text. Thin share is the locked 1-in-20 rule below. |
| CHOICE-02 | Several tokens on one provider. Rotate to the next live token. A refusal before the first token tries the next triple. After the first token, that triple stays until the tool turn ends. | One credential on `x-target-providers` per attempt, because the core gateway walks every listed target on any status. The parent sort is the rotation. A class request continues with delay 0, except status 400 which stops. A 2xx remembers the triple for a later tool-result turn. |
| BENCH-01 | Park failures on the source-chat scopes and durations. A shape 400, including a tool-schema mismatch, parks nobody. | `bench.ts` is the only writer. Class requests do not call `recordProviderCredentialOutcome`. Time is parsed from headers, then from JSON keys, never from prose. |
| BENCH-02 | Quota from that response. No hard-coded free-tier table. | Same parser. Groq remainder headers on success. OpenRouter `X-RateLimit-*` and `resets_at` when the body still has them. Do not copy OpenRouter's 20 per minute / 50 per day table. |
| BACK-02 | Probe a model CCR might serve, when it has no fresh time, within 1–2 minutes. A named time is the next probe. A large remainder skips the probe. A successful Claude turn clears the bench early. | A timer in `bench.ts`, started from `seam.start()`. The probe is `probeGatewayProvider` with `mode: "connectivity"` and `models: [that model]`. Catalog refresh stays `mode: "models"`. |
| SAFE-01 | A long thread, a slash model id, or a hex model id still runs the policy. The policy gets the model name, the tool list, and the image flag. It returns a parsed triple. It does not get the message body. | `attemptsForClass` keeps the Phase 1 signature plus scalars. `buildUpstreamAttempts` computes the scalars. Hex decode and `provider/model-with-slash` already work. Do not pass `messages`. |
| SAFE-02 | The user judges liveness from the bench and, in Phase 3, the notice. The card counts the user request. A failed leg is its own log line, without the API key. | Do not call `recordUsage` for a failed leg. One `console` line per failed class leg: status, provider, model, credential id. A 403 with no time says to fix the key and does not print the key. |
</phase_requirements>

## Summary

Phase 2 fills the shelf attempt list Phase 1 already returns. `plan.ts` keeps the class parse and the `[1m]` filter. It drops rows that are benched, out of quota, unable to do the request's tools or images, or shorter than the estimated request. It sorts confirmed models above an unchecked model of the same score, then applies a thin share. It repeats each surviving model once for each live token. The parent loop walks that list. There is no second policy call.

The core gateway already walks every name in `x-target-providers` on any failure, including a shape 400. A class attempt must therefore send exactly one credential. The parent's `selectProviderCredentials` order is the rotation. Parked keys are removed before that sort. A class 429, 401, 403, 404, or 5xx continues at once. A class 400 stops and parks nobody. `bench.ts` is the source of truth for a class request, so those requests do not also write the parent's 60-second cooldown.

Two facts constrain the bench clock. `retryDelayAfterStatus` clamps `Retry-After` to 60 seconds, so the bench must not use it to store the until-time. The installed core gateway, on a failed target, returns its own JSON status and does not copy upstream `Retry-After` or `X-RateLimit-*` headers. Times that live in the JSON (`next_flush_time`, `resets_at`, and OpenRouter's echoed `metadata.headers`) still arrive. A 429 with no parseable time parks for 60 seconds and says so.

An image inside `tool_result` is already counted by `estimateLimitUsage`, because that walk is recursive. The same image does not survive protocol translation: the gateway's user-content walker stringifies `tool_result` content through a text-only helper, while a sibling `image` block becomes `input_image`. Lift the image blocks onto the user message before the body is forwarded. Do that only for a class request.

**Primary recommendation:** Add `bench.ts`. Extend `plan.ts` and `seam.ts`. In `executor.ts`, send one live credential, stop on class 400, continue other class refusals with delay 0, and skip `recordProviderCredentialOutcome` for a class request. Do not add lower-class rows.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Choose the live triple | API / Backend | — | `createRouteExecutionPlan` already builds `attempts`. The class seam replaces that list. |
| Bench and quota clock | API / Backend | — | Written on the gateway response. One file under `resolveRuntimeDataDir()` so a restart and the later notice can read it. No UI screen in this phase. |
| Token rotation | API / Backend | — | Filter in `prepareUpstreamCredentialAttempt`. The parent sort stays. `credential-pool.ts` stays. |
| Pre-token refusal | API / Backend | — | The existing `fetchUpstreamWithFallback` loop. One condition and the delay. Do not read the SSE stream. |
| Tool-turn stickiness | API / Backend | — | A 2xx remembers provider, credential id, and model under the session header. The next plan sees a boolean, not the body. |
| Image survival | API / Backend | — | One body rewrite in class-switch, called from the attempt builder. The core gateway is not patched. |
| Liveness probe | API / Backend | — | Timer beside the catalog walk. It may spend one output token. The catalog walk still does not. |
| Success card and failed-leg line | API / Backend | — | Usage stays one event per user request. The leg is a log line. |
| Step-down notice | — | — | Phase 3. Do not read or write `notice.ts`. |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory, and no `.cursor/skills/` or `.agents/skills/` in this repo.

Conventions that bind this phase, from Phase 1 research and from `.planning/codebase/TESTING.md`:

- New source files are kebab-case. Domain types are `export type`, not `interface`.
- Tests are `packages/core/test/unit/class-switch/*.test.mjs`. Flat `test()` calls. `node:assert/strict`. Import source paths with the `.ts` extension.
- `packages/core/tsconfig.json` uses `"rootDir": "src"`. Do not put tests under `src`.
- `workflow.tdd_mode` is `true`. Write the failing unit tests before the implementation.
- `workflow.nyquist_validation` is `true`. `security_enforcement` is absent, so the security section below applies.
- `seam.ts` is the only module parent files import.
- `CCR_CLASS_SWITCH=0` makes every new seam return the parent behavior.
- The graph at `.planning/graphs/graph.json` is 43 commits behind (`built_at_commit` `adfb273`, `current_commit` `dc23389`). It does not contain `class-switch/`. The live files were read for this research. Do not plan from that graph.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | `>=22` (this machine: v22.23.2) | Runtime, `fetch`, `node:test` | `[VERIFIED: package.json engines]` `[VERIFIED: packages/core/package.json:10-12]` `"node": ">=22"` |
| Existing `estimateLimitUsage` | in repo | Image count and token estimate | Already walks the whole JSON body, including a nested `tool_result`. |
| Existing `decodeClaudeAppGatewayRouteId` | in repo | Hex route ids | Phase 1 already calls it before the slash check. Do not write a second codec. |
| Existing `selectProviderCredentials` | in repo | Token order | Priority, then utilization, then weight, then index. Do not add a second rotator. |
| Existing `probeGatewayProvider` | in repo | Liveness probe | `mode: "connectivity"` POSTs `ping` with `max_tokens` 1. `mode: "models"` stays the catalog walk. |
| `@the-next-ai/ai-gateway` | 1.0.21, already installed | Core gateway that walks `x-target-providers` | Do not upgrade it in this phase. Do not patch `node_modules`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert/strict` | Node 22.23.2 | Unit tests | The only runner. |
| Phase 1 shelf snapshot | `cache/class-switch-shelves.json` | Input rows | Read it. Do not change classification. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One credential per class attempt | Pass the whole unbenched chain and let the gateway rotate | The gateway continues on every status, including 400. That walks every token on a shape error. Issue #1843 forbids that. |
| `retryDelayAfterStatus` as the bench clock | Store the parsed until-time in `bench.ts` | The helper clamps `Retry-After` to 60 seconds. A one-hour reset would be stored as 60 seconds, and the user would wait that long before the next model. |
| Round-robin cursor in `bench.ts` | Parent `selectProviderCredentials` order | FORK-SEAMS says rotation of the remaining keys stays in the parent. A second cursor fights the parent sort. |
| `probeGatewayProvider` `mode: "models"` for BACK-02 | `mode: "connectivity"` with `models: [the shelf model]` | A model list does not tell you the model can answer. The connectivity probe spends one output token, which is the probe the design allows when no fresh time exists. |
| New rate-limit package | The parser in `bench.ts` | The locked inputs are a handful of header names and two JSON keys. A package would be a new dependency. |

**Installation:**

```bash
# no packages
```

This phase installs nothing. The Package Legitimacy Gate is not run.

## Package Legitimacy Audit

No external packages. Nothing to install, nothing removed, nothing flagged.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code
  |  POST /v1/messages
  |  model = claude-opus-… | best | opus[1m] | anthropic/claude-ccr-h<hex>
  v
buildUpstreamAttempts
  |  scalars only: tool names, hasImage, estimatedTokens, toolTurn, sessionId
  |  the message body does not enter attemptsForClass
  v
createRouteExecutionPlan
  |  seam.applyShelf
  |  not a class, or CCR_CLASS_SWITCH=0 --> parent attempts
  |  class, but no live triple --> parent attempts (Phase 3 will replace this)
  v
attempts = live triples on THIS shelf
  |  one row per live token, model repeated
  |  thin share may put a neighbor first
  v
fetchUpstreamWithFallback
  |  prepareUpstreamCredentialAttempt
  |     drop benched keys, parent sort, send exactly one key
  |  HTTP status before any body byte:
  |     400 --> stop, park nobody
  |     429 / 401 / 403 / 404 / 5xx --> bench.record, delay 0, next row
  |     2xx --> return that response (do not read the SSE stream)
  |     2xx + session id --> remember the triple
  v
bench file  cache/class-switch-bench.json
  ^
  |  probe timer, only models on a shelf with no fresh time
  |  probeGatewayProvider mode "connectivity", one model, max_tokens 1
```

Phase 3 later appends the lower shelf to the same list. Leave the empty-shelf return as `undefined`, which is what `attemptsForClass` does today when the list is empty. `[VERIFIED: packages/core/src/class-switch/plan.ts:135-136]`

```text
  return attempts.length ? attempts : undefined;
```

### Recommended Project Structure

```text
packages/core/src/class-switch/
├── bench.ts      # park, quota parse, probe timer, confirmed/ttft/remainder
├── catalog.ts    # unchanged classifier and shelf snapshot
├── plan.ts       # filters, sort, thin share, one row per live token
└── seam.ts       # only import from parent files

packages/core/test/unit/class-switch/
├── bench.test.mjs
├── choice.test.mjs
└── (existing plan, classify, context-window tests stay green)
```

Do not create `notice.ts`.

Parent edits, and no others:

| File | Edit |
|------|------|
| `packages/core/src/routing/execution-plan.ts` | Pass the new scalars through `applyShelf`. No new fallback mode. |
| `packages/core/src/gateway/upstream/executor.ts` | Compute scalars in `buildUpstreamAttempts`. One credential in `prepareUpstreamCredentialAttempt` for a class attempt. Class 400 stops. Other class refusals use delay 0. Skip `recordProviderCredentialOutcome` on a class attempt. Call `liftToolResultImages` only after the shelf replaced the plan. |
| `packages/core/src/gateway/request/pipeline.ts` | Skip `recordProviderCredentialOutcome` when the attempt was a class attempt. Do not add the Phase 3 headers. |

`pipeline.ts` is on the allowlist for the Phase 3 header seam. The skip is required because the final 5xx is recorded there, at the call this research read. `[VERIFIED: packages/core/src/gateway/request/pipeline.ts:906]`

```text
      recordProviderCredentialOutcome(this.config, method, upstreamResult.attempt, upstreamResponse.status, responseHeaders);
```

The failure-path call is in the executor. `[VERIFIED: packages/core/src/gateway/upstream/executor.ts:526]`

```text
        recordProviderCredentialOutcome(input.config, input.method, attempt, response.status, response.headers);
```

If either call still runs for a class request, a 5xx also writes the parent 60-second cooldown and the bench's 30 seconds cannot win. Do not edit the body of `recordProviderCredentialOutcome`.

### Pattern 1: One credential, because the gateway walks the whole list

`prepareUpstreamCredentialAttempt` puts every selected credential on `x-target-providers`. `[VERIFIED: packages/core/src/gateway/upstream/executor.ts:674-678]`

```text
    "x-target-providers": selection.credentials.map((candidate) => candidate.internalName).join(","),
    "x-ccr-logical-provider": providerRuntimeId(target.provider),
    "x-ccr-provider-credential-chain": selection.credentials.map((candidate) => candidate.credentialId).join(",")
```

Installed `@the-next-ai/ai-gateway` 1.0.21 (`packages/core/package.json` dependency `^1.0.21`, installed `version` `1.0.21`) continues to the next target on any failure when `scheduling` is absent. CCR's compiler never sets `scheduling`. The predicate is:

DATA_k7m2pq9w_START
function je(e,n,t,r){let o=n[t+1];if(!o)return!1;let i=e.scheduling;if(!i?.enabled)return!0;if(i.fallback.mode==="off")return!1;let s=r?.status;if(typeof s!="number")return!1;let a=n[t];return(a1(e,a,o)?i.fallback.retryStatusCodes:i.fallback.crossProviderStatusCodes).includes(s)}
DATA_k7m2pq9w_END

`!i?.enabled` returns true. A shape 400 would walk every credential in the list. A class attempt sets both headers to the single first credential after parked keys are removed. The attempt list repeats the model once per live credential, so the next CCR row is the next token. On a 400 there is no next gateway target, and the CCR condition does not continue.

Non-class requests still pass the full chain. `CCR_CLASS_SWITCH=0` is a non-class request for this rule.

The parent order, which is the rotation, is `[VERIFIED: packages/core/src/gateway/upstream/executor.ts:1059-1064]`

```text
  const prioritySorted = [...candidates].sort((left, right) =>
    left.priority - right.priority ||
    left.limitState.utilization - right.limitState.utilization ||
    right.weight - left.weight ||
    left.index - right.index
  );
```

Do not add a round-robin cursor. After a token is parked, the next request's first remaining key is the next live token.

### Pattern 2: Class continuation is not `shouldFallbackAfterStatus`

`shouldFallbackAfterStatus` follows `Router.fallback.mode`. In `off` and `retry`, a 401, 403, or 404 does not continue, because those statuses are class `client`. `[VERIFIED: packages/core/src/routing/failure-classifier.ts:10-17]`

```text
    shouldFallback: mode === "model-chain"
      ? statusCode >= 400
      : failureClass === "retryable" || failureClass === "rate-limit" || failureClass === "server"
```

A class request ignores that mode. Continue when the status is 401, 403, 404, 408, 409, 429, or 5xx, and on a network error. Stop on 400. Statuses with no bench row (402, 408, 409, network error) still try the next row in this request and do not write a park. Do not invent a 402 rule. The locked table does not have one.

Delay for every class continuation is 0. FORK-SEAMS requires delay 0 on class 429 so Claude does not wait out `Retry-After` before the next model. The same wait on 401 or 5xx is the parent's exponential backoff, which starts at 1 second and caps at 30 seconds. `[VERIFIED: packages/core/src/gateway/upstream/retry-policy.ts:5-7]`

```text
const upstreamRetryBackoffBaseMs = 1_000;
const upstreamRetryBackoffMaxMs = 30_000;
const upstreamRetryAfterMaxMs = 60_000;
```

That helper also clamps a present `Retry-After` to 60 seconds. The bench stores the unclamped until-time. The user-facing delay stays 0. Non-class requests still call `shouldFallbackAfterStatus` and `retryDelayAfterStatus`.

### Pattern 3: Bench record

One JSON file beside the shelf snapshot. `[VERIFIED: packages/core/src/class-switch/catalog.ts:331-333]`

```text
export function shelfSnapshotPath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "class-switch-shelves.json");
}
```

Write `cache/class-switch-bench.json` with the same temp-file rename `writeShelfSnapshot` already uses. The record holds credential ids and model ids. It does not hold an API key.

Scopes:

| Status | Key | Until |
|--------|-----|-------|
| 429 | provider + credential id + model | parsed time, else 60 seconds |
| 401 and no time | provider + credential id, all models | 5 minutes, then the probe may try once |
| 403 with `resets_at` | provider + credential id, all models | that timestamp, floored to the minute the value names |
| 403 without a time | provider + credential id, all models | no `until`; `probe: false`; log line tells the user to fix the key |
| 404 | provider + model, all credentials | 1 hour |
| 5xx | provider + model, all credentials | 30 seconds |
| 400 | none | none |

A 404 is for the provider that returned it, not every provider that hosts the same model id.

A 2xx for that provider + credential id + model clears 429, 401, 403, 404, and 5xx rows that cover that triple. It sets `confirmed: true` and stores the observed duration and any remainder headers. It does not clear another token's 429.

Quota zero is a 429-shaped park of this token on this model: a success or error whose remaining-request count is `0`, or whose remaining-token count is `0`, until the paired reset on that same response. No remainder header means "unknown", and unknown is not zero.

`readCatalogCapability` is true only when the value is `true`. `[VERIFIED: packages/core/src/gateway/model-catalog.ts:180-182]`

```text
export function readCatalogCapability(capabilities: ModelCatalogCapabilities, key: string): boolean {
  return capabilities[key] === true;
}
```

Tool filter: the request has at least one tool name, and the catalog entry has `toolCalling === false` or `functionCalling === false`. Drop that model. Missing keys do not drop it. There is no `tools` field on `ProviderModelCapabilities`. `[VERIFIED: packages/core/src/contracts/app.ts:198-201]`

```text
export type ProviderModelCapabilities = {
  imageInput?: boolean;
  webSearch?: boolean;
};
```

Image filter: `hasImage` is true, and either `metadata.capabilities.imageInput === false` or the catalog entry has an explicit false `imageInput` or `vision`. Missing means keep. Do not drop a model because the catalog helper returns false for a missing key. Read the raw value.

Context filter: `estimatedTokens` is `estimateLimitUsage(method, body).totalTokens`. Drop the row when `contextWindow` is a finite number greater than 0 and `estimatedTokens` is greater than that window. A missing window does not drop the row. The `[1m]` filter stays as Phase 1 wrote it. `estimateLimitUsage` adds `max_tokens`, or 1024 when `max_tokens` is absent, to the character estimate. `[VERIFIED: packages/core/src/gateway/limits/window-limiter.ts:68-80]`

```text
  const inputTokens = Math.ceil(inputCharacters / 4);
  const outputTokens = readPositiveNumber(body.max_completion_tokens) ??
    readPositiveNumber(body.max_tokens) ??
    readPositiveNumber(body.max_output_tokens) ??
    readPositiveNumber(generationConfig?.maxOutputTokens) ??
    readPositiveNumber(generationConfig?.max_output_tokens) ??
    1024;
  return {
    imageCount: countImageInputs(body),
    totalTokens: Math.max(1, inputTokens + outputTokens)
  };
```

Use `imageCount > 0` as `hasImage`. `countImageInputs` recurses, so an image inside `tool_result` counts. Do not write a second walker.

### Pattern 4: Time parser

Read, in this order, and stop at the first hit:

1. Header `retry-after`. Delay-seconds or HTTP-date. `[CITED: https://github.com/mdn/content/blob/main/files/en-us/web/http/reference/headers/retry-after/index.md]` Do not clamp.
2. Header `x-ratelimit-reset`. All digits, 13 or more: Unix milliseconds. All digits, 10 to 12: Unix seconds. Otherwise HTTP-date, then delay-seconds. OpenRouter's key-management text says this header is milliseconds since the Unix epoch. `[CITED: https://openrouter.ai/docs/api/reference/limits]`
3. Groq duration headers `x-ratelimit-reset-requests` and `x-ratelimit-reset-tokens`, but only when the paired remaining count is the one that hit zero. A value `2m59.56s` or `7.66s` is a duration from now, not a timestamp. `[CITED: https://console.groq.com/docs/rate-limits]` These names are not `X-RateLimit-Reset`. The locked generic header will miss them.
4. JSON, exact keys `next_flush_time` and `resets_at` only. Walk the response JSON and `error.attempts[].details`. Accept an ISO-8601 string, Unix seconds, or Unix milliseconds. OpenRouter puts a 403 budget `resets_at` on `error.metadata` as ISO-8601, and a platform 429 can echo `X-RateLimit-Reset` under `metadata.headers`. `[CITED: https://openrouter.ai/docs/api/reference/limits]`
5. No hit. For a 429 only, park 60 seconds. `shortcut: the provider sent no clock, replace this when a later response has one.` The 60 seconds is the parent's existing cooldown constant. `[VERIFIED: packages/core/src/providers/credential-pool.ts:16]`

```text
const providerCredentialCooldownMs = 60_000;
```

Do not search the `message` string. Do not copy a free-tier RPM table. Groq's published per-model RPM table on that same docs page is not a CCR limiter.

On a failed target the gateway does `n.code(status).send(aggregatePayload)`. The bundle contains no `retry-after` and no `x-ratelimit`. Upstream headers on a failure do not reach CCR. The JSON does. On a success, `RR` copies upstream headers with `headers.forEach`, so Groq remainder headers on a 200 are visible. Store those on the health row. They are what "large remainder" and "quota left" read.

Large remainder, locked here: skip the extra probe when the newest sample for that model has remaining requests greater than 10, or remaining tokens greater than 10000, and that sample is inside the reset duration it came with. OpenRouter success responses omit `X-RateLimit-*`, so an OpenRouter model does not get this skip unless a 429 body echoed a remainder. `[CITED: https://openrouter.ai/docs/api/reference/limits]` That is expected. Do not call `GET /api/v1/key` to fill the gap.

### Pattern 5: Sort, then thin share

Sort key:

1. Score descending. A missing score stays last, as Phase 1 `compareShelfRows` already does.
2. Confirmed before unchecked, only when the scores are equal.
3. Higher remaining requests, then higher remaining tokens. Unknown does not beat a known lower remainder. This breaks a tie only.
4. Lower last success duration. Unknown does not beat a known slower model.
5. `provider`, then `model`, `localeCompare`.

Thin share, locked here: after that sort, the leader is index 0. A neighbor is a later row with the same confirmed-or-not rank and a score within 2 of the leader. Keep a process-local counter. When `counter % 20 === 0` and a neighbor exists, rotate the first neighbor to the front for this request. Otherwise the leader stays first. One thin request in 20, not one per neighbor. No `Math.random`. Tests set the counter.

### Pattern 6: Tool turn without the body

`attemptsForClass` parameters are the parsed class, the registry, and this scalar bag:

```text
toolNames: string[]
hasImage: boolean
estimatedTokens: number
toolTurn: boolean
sessionId: string | undefined
```

No `body`, no `messages`, no `headers`. A unit test calls it with those fields only.

The parent already has the body in `buildUpstreamAttempts`. It may call two class-switch helpers that are not the policy:

- `requestFacts(body)` returns `{ toolNames, hasImage, estimatedTokens, toolTurn }`. `toolTurn` is true when the last user content is a non-empty array and every block has `type` `tool_result`.
- `liftToolResultImages(body)` returns a new body. Call it only when `applyShelf` replaced the attempts.

Session id comes from headers the executor already receives. Use the same names `resolveArchiveSessionId` already reads. `[VERIFIED: packages/core/src/gateway/context-archive.ts:720-731]`

```text
    readHeader(headers, "x-claude-code-session-id"),
    readHeader(headers, "x-claude-session-id"),
    readHeader(headers, "x-codex-session-id"),
    readHeader(headers, "x-openai-session-id"),
    readHeader(headers, "x-agent-session-id"),
    readHeader(headers, "x-session-id"),
    stringValue(isRecord(body.metadata) ? body.metadata.session_id : undefined),
```

Pass the header hits and, if still empty, `metadata.session_id` from `requestFacts`. Do not pass the metadata object into the policy.

On a class 2xx, if a session id exists, remember `{ provider, credentialId, model }` for that session. On the next class plan, if `toolTurn` is true and that triple is still live, the attempt list is that one row. If it is benched, forget it and build the normal list. No session id means no cross-request memory. Do not buffer the SSE body to find the first token. A 2xx is the commit. A later SSE `finish_reason: "error"` stays on that triple. OpenRouter documents that a limit hit after the stream starts is a 200 plus an SSE error. `[CITED: https://openrouter.ai/docs/api/reference/limits]`

### Pattern 7: Image lift

The gateway's user-content walker does this for a `tool_result` block: `content: fF(o.content)`. `fF` maps blocks through `me`, and `me` returns only `text` / `input_text` / `output_text`. If any text exists, the image blocks are dropped. A top-level block with `type === "image"` becomes `{ type: "input_image", image_url }`. Both snippets are in `@the-next-ai/ai-gateway@1.0.21` `dist/index.js`.

`liftToolResultImages` copies the body. For each user message whose `content` is an array, for each `tool_result` whose `content` is an array, move blocks with `type` `image`, `image_url`, or `input_image` onto the parent content array. If the tool result then has no text block, append `{ type: "text", text: "image" }`. Do not lift for a non-class request. Do not edit the gateway package.

### Pattern 8: Probe

Start and stop it from `seam.start()` / `seam.stop()`, next to the catalog. `CCR_CLASS_SWITCH=0` starts neither.

Every 30 seconds, look at shelf rows only (not `excluded`, not `review`). Skip a row that is 403-fix-key. If the provider named a future time, `nextProbeAt` is that time. If the remainder is large, skip. Otherwise, if there is no successful check and no future time, `nextProbeAt` is 60 to 120 seconds from the moment the row became due. The 60–120 span is the locked "within 1–2 minutes". Tests inject `now`.

The probe calls `probeGatewayProvider` with `mode: "connectivity"`, `forceRefresh: true`, and `models: [that one model]`. `pickProbeModel` returns `candidates[0]` when the regex misses, so a one-element list probes that model. `probeOutputTokenLimit` is 1. `[VERIFIED: packages/core/src/providers/probe.ts:96]`

```text
const probeOutputTokenLimit = 1;
```

A connectivity probe can return 400 for a model that rejects `ping`. A 400 parks nobody. A 429, 401, 403, 404, or 5xx uses the bench table. Do not point this probe at `mode: "models"`. Do not send it for a model the shelf does not contain.

401 recheck is this same probe, every 5 minutes, for that token. 403 with `resets_at` does not schedule a probe. The park simply expires.

### Pattern 9: Log line and the success card

`recordUsage` runs from `pipeline.ts` once per user request. The executor loop does not call it. Do not add a usage event on a failed leg. `buildTotals` counts each usage event by its final status. `[VERIFIED: packages/core/src/usage/store.ts:1035-1043]`

```text
  const requestCount = events.length;
  const successfulRequests = events.filter((event) => event.statusCode >= 200 && event.statusCode < 400).length;
  const errorCount = events.filter((event) => event.statusCode > 0 && (event.statusCode < 200 || event.statusCode >= 400)).length;
```

One line per failed class leg, and one line for a 403 with no time:

```text
[class-switch] leg status=429 provider=openrouter model=nvidia/nemotron-3 credential=cred:third until=2026-11-14T22:05:00.000Z
[class-switch] fix-key provider=openrouter credential=cred:third status=403
```

The credential value is the slug from `providerCredentialSlug` / the id already on `x-ccr-provider-credential-id`. Never interpolate `api_key`, `authorization`, or the raw key. The bench file uses the same id.

The existing request log stays one row. Its `x-ccr-fallback-*` headers already describe earlier legs. Do not insert a second request-log row. That row would become a second usage-shaped failure if a later change records it.

### Anti-Patterns to Avoid

- **Passing `messages` into `attemptsForClass`.** A long thread is the failure in parent issue #1928. The scalars are the whole policy input.
- **Repeating the full credential chain on a class attempt.** The gateway walks it, including on 400.
- **Calling `retryDelayAfterStatus` to decide how long a token sits.** It clamps to 60 seconds and it delays the user.
- **Calling `recordProviderCredentialOutcome` for a class attempt.** The 60-second cooldown then outlives a 30-second 5xx park.
- **Appending the next lower class.** That is Phase 3. An empty live list keeps today's `undefined`, and the parent plan remains.
- **A free-tier table, or `GET /api/v1/key` on the request path.** The response in hand is the quota source.
- **Parsing a reset out of `error.message`.** Exact keys and headers only.
- **Buffering the SSE stream to hunt for the first token.** The HTTP status is the refusal boundary. A 2xx stays.
- **Editing `credential-pool.ts` or adding a field to `UpstreamAttempt`.** The type is closed. `[VERIFIED: packages/core/src/gateway/internal/shared.ts:182-192]`

```text
export type UpstreamAttempt = {
  body?: Buffer;
  credentialChain?: string[];
  credentialIds?: string[];
  credentialProtocol?: GatewayProviderProtocol;
  headers?: Record<string, string>;
  index: number;
  logicalProvider?: string;
  model?: string;
  target?: RouteModelRef;
};
```

- **Splitting a model id on every slash.** `parseProviderModelSelector` splits the first slash only. The rest is the model id. `[VERIFIED: packages/core/src/routing/model-registry.ts:180-191]`

```text
export function parseProviderModelSelector(value: string | undefined): { model: string; provider: string } | undefined {
  const normalized = normalizeRouteSelector(value);
  if (!normalized) {
    return undefined;
  }
  const separator = normalized.indexOf("/");
  if (separator <= 0 || separator >= normalized.length - 1) {
    return undefined;
  }
  const provider = normalized.slice(0, separator).trim();
  const model = normalized.slice(separator + 1).trim();
  return provider && model ? { model, provider } : undefined;
}
```

Phase 1 already emits `BenchProvider/motif-technologies/motif-3` and the hex route of `claude-opus-4-6` opens Opus. `[VERIFIED: packages/core/test/unit/class-switch/plan.test.mjs:211-216]` Keep that. Do not reject a shelf model because the model id contains `/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex route ids | A new decoder | `decodeClaudeAppGatewayRouteId` | Phase 1 already decodes `anthropic/claude-ccr-h…` before the slash check. |
| Slash model ids | A parser that splits every slash | `parseProviderModelSelector` | The first slash is the provider. The model id may contain more slashes. |
| Token estimate and image count | A new walker | `estimateLimitUsage` | It already recurses into `tool_result` and adds `max_tokens`. |
| Token order | A round-robin cursor | `selectProviderCredentials` | The parent order is the rotation. Filter parked keys first. |
| Model-list refresh | A second catalog | Phase 1 `mode: "models"` walk | BACK-02 is a different probe. Do not merge the timers. |
| Rate-limit database | A free-tier table or a new package | Header and JSON parse in `bench.ts` | The provider response is the source. The table would go stale the day a vendor changes a cap. |
| Request loop | A second loop or a second policy call | `fetchUpstreamWithFallback` | The list is built once. |
| Success-card math | A new counter | The existing one usage event | A second event makes a failed leg look like a failed user request. |

**Key insight:** The parent loop can walk triples only if each attempt is one token. The gateway will otherwise spend the whole chain, including on a 400, and it will throw away the upstream rate-limit headers on the way back.

## Common Pitfalls

### Pitfall 1: The gateway walks every target on a 400

**What goes wrong:** A tool-schema 400 tries every token, then the next model. The model looks dead. Issue #1843.
**Why it happens:** `je` returns true for every status when `scheduling` is missing, and CCR does not set `scheduling`.
**How to avoid:** One credential on `x-target-providers` and `x-ccr-provider-credential-chain` for a class attempt. Stop the CCR loop on 400.
**Warning signs:** A 400 log line shows more than one credential id.

### Pitfall 2: `Retry-After` never arrives on a failure

**What goes wrong:** The bench parks every 429 for 60 seconds, or parks nothing and hot-loops.
**Why it happens:** The gateway's failure return is `n.code(status).send(payload)`. The payload is the aggregate JSON. The bundle never copies `retry-after`.
**How to avoid:** Parse JSON keys and echoed `metadata.headers` first-class. Keep the header parser for successes and for any response that still has the header. The 60-second shortcut is only the last branch of a 429.
**Warning signs:** A test that only sets `response.headers` and never the body, then expects a Groq 429 through the real gateway to park for `retry-after`. That test will fail against the real gateway. Unit-test the parser with the JSON the gateway actually returns.

### Pitfall 3: The 60-second parent cooldown hides the bench

**What goes wrong:** A 5xx is servable again at 30 seconds in `bench.ts` and still skipped until 60 seconds. A 404 clears the parent cooldown (404 is not in the parent's cooldown set) but the class filter must still hide the model for an hour.
**Why it happens:** `recordProviderCredentialOutcome` treats 401, 403, 429, and 5xx as a 60-second cooldown, and treats other 4xx, including 404, as a clear. `[VERIFIED: packages/core/src/providers/credential-pool.ts:57-64]`

```text
  if (statusCode >= 200 && statusCode < 500 && statusCode !== 401 && statusCode !== 403 && statusCode !== 429) {
    incrementProviderCredentialCounters(provider, credential, estimateLimitUsage(method, attempt.body ?? Buffer.alloc(0)));
    clearProviderCredentialCooldown(provider, credential);
    return;
  }
  if (statusCode === 401 || statusCode === 403 || statusCode === 429 || statusCode >= 500) {
    setProviderCredentialCooldown(provider, credential, providerCredentialCooldownMs, `HTTP ${statusCode}`);
  }
```

**How to avoid:** Class attempts do not call that function. The bench file is the only park.
**Warning signs:** A class 5xx test still finds `readProviderCredentialCooldown` set.

### Pitfall 4: Groq reset values are durations

**What goes wrong:** `2m59.56s` is parsed as an HTTP-date, yields `NaN`, and the token is parked for 60 seconds while the daily window has hours left. Or it is ignored and the probe fires immediately.
**Why it happens:** The locked header name is `X-RateLimit-Reset`. Groq's names are `x-ratelimit-reset-requests` and `x-ratelimit-reset-tokens`, and the values are durations.
**How to avoid:** Pattern 4, branch 3. Apply a duration from now. Do not `Date.parse` that string.
**Warning signs:** A fixture `2m59.56s` produces `until` equal to `now + 60_000`.

### Pitfall 5: OpenRouter `X-RateLimit-Reset` is milliseconds

**What goes wrong:** `1792448640000` is read as seconds and the park lasts centuries. Or a 10-digit Unix seconds value is read as milliseconds and the park expires in 1970.
**Why it happens:** The same header name is used as milliseconds (OpenRouter key-management) and, elsewhere, as seconds.
**How to avoid:** 13 or more digits means milliseconds. 10 to 12 digits means seconds. A small number is a delay only when it is not this header's documented millisecond form. Delay-seconds belong to `Retry-After`, which is tried first.
**Warning signs:** A 13-digit fixture parks past year 50000.

### Pitfall 6: Image counted, then destroyed

**What goes wrong:** The chooser keeps a vision model, and the upstream model receives the text "image" plus a JSON string of base64, or no image at all.
**Why it happens:** `estimateLimitUsage` counts the nested image. The gateway then flattens `tool_result` to text.
**How to avoid:** Lift image blocks to sibling content on the same user message, class requests only.
**Warning signs:** A fixture `{ type: "tool_result", content: [{ type: "text", text: "see" }, { type: "image", source: { type: "base64", media_type: "image/png", data: "aGVsbG8=" } }] }` leaves the image inside `tool_result` on the forwarded body.

### Pitfall 7: Empty shelf "fixed" in this phase

**What goes wrong:** Phase 2 appends Sonnet under Opus. Phase 3 then has two ladders, or the notice fires before the notice code exists.
**Why it happens:** FORK-SEAMS describes the full milestone list, including step-down. This phase's success criteria do not.
**How to avoid:** No live triple returns `undefined`, same as Phase 1. Phase 3 replaces that return.
**Warning signs:** An Opus request with an empty Opus shelf and a live Sonnet row produces a Sonnet attempt.

### Pitfall 8: Failed leg counted as a failed user request

**What goes wrong:** The success card drops while the user request succeeded.
**Why it happens:** A second `recordUsage`, or a second request-log row that something later sums.
**How to avoid:** One usage event. One log line. No API key on that line.
**Warning signs:** A test that fails over once and then succeeds sees `errorCount === 1` on the usage totals.

### Pitfall 9: Probe uses the catalog walk

**What goes wrong:** Every 10 minutes CCR generates `ping` for every model, or the liveness probe only refreshes the model list and never learns that a model is 429.
**Why it happens:** The two walks get merged, or BACK-02 calls `mode: "models"`.
**How to avoid:** Separate timer. Connectivity mode. One model id. `forceRefresh: true`.
**Warning signs:** The probe mock sees `mode: "models"`, or sees a body for every shelf row on the same tick.

## Code Examples

### Class scalars, not the body

```typescript
// Source: this repo, packages/core/src/gateway/limits/window-limiter.ts
// Parent computes this. attemptsForClass receives the numbers only.
const usage = estimateLimitUsage(method, body);
const facts = {
  estimatedTokens: usage.totalTokens,
  hasImage: usage.imageCount > 0,
  toolNames, // names only, same shape as route-script-context toolNames
  toolTurn   // last user content is only tool_result blocks
};
```

### Bench decision

```typescript
// Source: locked table in .planning/research/IMPORTED-DESIGN.md
// status 400 -> no row
// status 429 -> row(provider, credentialId, model, until)
// status 401 and no until -> row(provider, credentialId, "*", until = now + 5 * 60_000), probe allowed
// status 403 and resets_at -> row(provider, credentialId, "*", until), probe forbidden
// status 403 and no until -> row(provider, credentialId, "*", probe: false) plus the fix-key log line
// status 404 -> row(provider, "*", model, until = now + 60 * 60_000)
// status >= 500 -> row(provider, "*", model, until = now + 30_000)
```

### One-target header edit

```typescript
// Inside prepareUpstreamCredentialAttempt, class attempt only.
// selection is the existing selectProviderCredentials result after benched keys are removed.
const chosen = selection.credentials[0];
headers["x-target-providers"] = chosen.internalName;
headers["x-ccr-provider-credential-chain"] = chosen.credentialId;
```

### Retry-After without the 60-second clamp

```typescript
// Source: MDN Retry-After. Do not call retryDelayAfterStatus for the stored until-time.
// "Retry-After: 120" is 120 seconds. "Retry-After: Wed, 21 Oct 2015 07:28:00 GMT" is that instant.
```

### Groq duration

```typescript
// Source: https://console.groq.com/docs/rate-limits
// x-ratelimit-reset-requests: 2m59.56s
// x-ratelimit-reset-tokens: 7.66s
// retry-after: 2          // seconds, only on 429
// x-ratelimit-remaining-requests is RPD, sent on success too
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parent credential chain as the retry | One credential per class attempt, next token is the next CCR row | This phase, because ai-gateway 1.0.21 walks every target | A 400 stops. A 429 still reaches the next token. |
| `recordProviderCredentialOutcome` 60-second cooldown for every status it cares about | `bench.ts` for class requests. The 60-second map stays for every other request | This phase | 5xx can be 30 seconds. 404 can be 1 hour. 401 can be 5 minutes. |
| Route script sees the dialog | Scalars only | Parent issue #1928, locked here | A long thread cannot drop the policy. |
| Second policy call on each refusal | One list | FORK-SEAMS supersedes PR #1179 | The executor is not a planner. |

**Deprecated/outdated:**

- PR #1179 as the implementation. Do not call the policy from inside the loop.
- Treating `x-ccr-provider-credential-chain` as proof that a 429 switches keys inside CCR. CCR's own loop does not. The gateway does, and that is why the chain must be length 1 for a class attempt.
- `retryDelayAfterStatus` as a bench clock. It is a user-facing wait, capped at 60 seconds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Thin share is 1 request in 20, for one neighbor within 2 score points of the leader, same confirmed rank. | Pattern 5 | The share is thicker or thinner than the user wanted. The tests lock the numbers. Change the constants, not the shape. |
| A2 | Large remainder means remaining requests > 10 or remaining tokens > 10000. | Pattern 4 | A small daily remainder skips probes, or a still-healthy key gets a `ping` every 1–2 minutes. |
| A3 | A 429 with no parseable time parks for 60 seconds, the parent cooldown constant. | Pattern 4 | A provider that omits the clock is retried too soon, or hidden for too long. The log line says `no-provider-time`. |
| A4 | 402, 408, 409, and a network error try the next row and write no bench row. | Pattern 2 | A credit 402 is chosen again on the next user message. The locked table does not name 402. |
| A5 | 404 parks that provider's model for every token of that provider, not the model id on other providers. | Pattern 3 | A broken provider still leaves the same model live elsewhere. A global 404 would hide a working provider. |
| A6 | A 2xx is "after the first token". The SSE stream is not buffered. | Pattern 6 | A 200 whose first event is an error stays on that triple until the tool turn ends. That matches the locked "after the first token, stay". |
| A7 | No session header and no `metadata.session_id` means no cross-request stickiness. | Pattern 6 | Two HTTP requests in one tool turn can choose different models when Claude does not send a session id. |
| A8 | Unknown tool or image capability keeps the model. Only an explicit false drops it. | Pattern 3 | A model that cannot take an image still receives one. The lift still runs. A false positive drop would hide models the catalog simply does not describe. |
| A9 | Class attempts skip both `recordProviderCredentialOutcome` call sites, including `pipeline.ts`. | Pattern 1 | Leaving the pipeline call in place makes every final class 5xx a 60-second parent cooldown. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **Upstream `Retry-After` on a failed gateway attempt**
   - What we know: ai-gateway 1.0.21 does not copy that header onto the aggregate error. JSON fields and echoed `metadata.headers` do survive. Success responses do copy headers.
   - What's unclear: Whether a future gateway release will forward the header. This phase does not upgrade the package.
   - Recommendation: Parse both. The 60-second shortcut covers a header that was dropped. Do not block the phase on a gateway change.

2. **Phase 1 human verification is still deferred**
   - What we know: Shelves, score, and the 10-minute refresh are in the tree. `01-VERIFICATION.md` is `human_needed`.
   - What's unclear: Nothing this phase must re-decide.
   - Recommendation: Build on `readShelfSnapshot()`. Do not edit the classifier.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime and unit tests | ✓ | v22.23.2 | — |
| npm | `npm run test:unit` | ✓ | 12.2.2 | — |
| `@the-next-ai/ai-gateway` | Credential-chain behavior, image translation | ✓ | 1.0.21 | Do not upgrade. The one-credential rule and the image lift assume this version. |

**Missing dependencies with no fallback:**

- None.

**Missing dependencies with fallback:**

- None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert/strict` (Node v22.23.2) |
| Config file | `build/test.mjs` compiles, `build/run-tests.mjs` runs. No Jest config. |
| Quick run command | `npm run test:unit -w @claude-code-router/core` |
| Full suite command | `npm run test:unit -w @claude-code-router/core` |

`workflow.tdd_mode` is `true`. The first task writes the new tests and sees them fail, then implements. Do not edit parent test files outside `packages/core/test/unit/class-switch/`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHOICE-01 | Highest score wins. Same score: confirmed before unchecked. A higher unchecked score still beats a lower confirmed score. Image in `tool_result` sets `hasImage`. Window shorter than `estimatedTokens` is dropped. Missing window is kept. Explicit `imageInput: false` drops an image request. Missing image capability keeps it. Thin share: request 20 puts the neighbor first; request 1 keeps the leader. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| CHOICE-01 | `liftToolResultImages` moves an `image` block out of `tool_result` onto the user message and leaves a text block. A non-class body is unchanged. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| CHOICE-02 | Two credentials on one provider produce two rows of the same model. The prepared class attempt sets `x-target-providers` to one internal name. A 429 schedules the next row with delay 0. A 400 produces no next row and no bench row. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| CHOICE-02 | `toolTurn` true plus a remembered live triple returns that one row. A new user text message does not. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| BENCH-01 | 429 uses `Retry-After` seconds, then an HTTP-date, then `X-RateLimit-Reset` milliseconds, then `resets_at` ISO, then `next_flush_time`. A 13-digit reset is milliseconds. `2m59.56s` is a duration. No clock parks 60 seconds. 401 is all models of that token for 5 minutes. 403 with `resets_at` does not set a probe. 403 without a time sets `probe: false`. 404 is one hour for that provider's model. 5xx is 30 seconds. 400 writes nothing. A message string that contains a time is ignored. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| BENCH-02 | A fixture with Groq `x-ratelimit-remaining-requests: 0` parks until the Groq duration header. No source file contains a free-tier RPM map. A test that imports a table fails because the export does not exist. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| BACK-02 | A shelf model with no time is due between 60 and 120 seconds. A future `until` is the next probe. Remaining requests 11 skips the probe. A 2xx clears a 429 row for that triple only. The probe mock receives `mode: "connectivity"` and `models` of length 1. `mode: "models"` is absent. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |
| SAFE-01 | Hex route `anthropic/claude-ccr-h` + hex of `claude-opus-4-6` still opens Opus. Attempt model `BenchProvider/motif-technologies/motif-3` stays one selector. `attemptsForClass` is called without a body and still returns rows. `CCR_CLASS_SWITCH=0` keeps the parent attempt. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 for the scalar call. Hex and slash already exist in `plan.test.mjs`. |
| SAFE-02 | A failed leg does not call `recordUsage`. The log line contains the credential id and does not contain the fixture API key. A 403 with no time includes `fix-key`. | unit | `npm run test:unit -w @claude-code-router/core` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test:unit -w @claude-code-router/core`
- **Per wave merge:** `npm run test:unit -w @claude-code-router/core`
- **Phase gate:** Full unit suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/core/test/unit/class-switch/bench.test.mjs` — BENCH-01, BENCH-02, BACK-02
- [ ] `packages/core/test/unit/class-switch/choice.test.mjs` — CHOICE-01, CHOICE-02, SAFE-01 scalars, SAFE-02 log line, image lift
- [ ] Existing `plan.test.mjs` must stay green. Do not delete the hex or slash cases.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase does not add a login. It must not print a provider key. |
| V3 Session Management | no | The session id is only a stickiness key. It is not an auth session. |
| V4 Access Control | yes | A parked credential is not placed on `x-target-providers`. A 403 with no time is not probed. |
| V5 Input Validation | yes | Status codes, header values, and exact JSON keys. A 400 does not become a park. Do not `eval` a header. Do not trust `error.message` as a clock. |
| V6 Cryptography | no | No new crypto. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key in the failed-leg log or the bench file | Information disclosure | Log and store `providerCredentialSlug` / credential id only. The existing sensitive-header set stays the request-log redactor. Do not bypass it. |
| Shape 400 poisons a healthy model | Tampering | Status 400 writes no bench row and stops the chain. |
| Hot loop on 429 burns the remaining quota | Denial of service | Park from the parsed clock. Delay 0 only switches to the next triple. It does not retry the same triple. |
| Probe `ping` against a fix-key 403 | Elevation / abuse of a bad credential | `probe: false` on that row. The timer skips it. |
| Policy receives the dialog | Information disclosure, and the #1928 outage | `attemptsForClass` has no body parameter. |

## Sources

### Primary (HIGH confidence)

- Live files read this session: `packages/core/src/class-switch/plan.ts`, `seam.ts`, `catalog.ts`; `packages/core/src/gateway/upstream/executor.ts`; `packages/core/src/gateway/upstream/retry-policy.ts`; `packages/core/src/routing/failure-classifier.ts`; `packages/core/src/providers/credential-pool.ts`; `packages/core/src/routing/model-registry.ts`; `packages/core/src/gateway/limits/window-limiter.ts`; `packages/core/src/gateway/model-catalog.ts`; `packages/core/src/contracts/app.ts`; `packages/core/src/gateway/internal/shared.ts`; `packages/core/src/usage/store.ts`; `packages/core/src/providers/probe.ts`; `packages/core/src/gateway/context-archive.ts`; `packages/core/src/gateway/core-runtime/config-compiler.ts`; `node_modules/@the-next-ai/ai-gateway/package.json` and `dist/index.js` (version 1.0.21, functions `je`, `WR`, `fF`, `me`).
- `.planning/research/IMPORTED-DESIGN.md`, `.planning/research/FORK-SEAMS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`.

### Secondary (MEDIUM confidence)

- [CITED: https://github.com/mdn/content/blob/main/files/en-us/web/http/reference/headers/retry-after/index.md] — `Retry-After` is delay-seconds or an HTTP-date. Context7 library `/mdn/content`.

### Tertiary (LOW confidence until the official page was fetched)

- [CITED: https://console.groq.com/docs/rate-limits] — fetched this session. `retry-after` seconds on 429 only. Remaining headers always. Reset headers are durations `2m59.56s` and `7.66s`.
- [CITED: https://openrouter.ai/docs/api/reference/limits] — fetched this session. Success responses omit `X-RateLimit-*`. Key-management `X-RateLimit-Reset` is Unix milliseconds. 403 `error.metadata.resets_at` is ISO-8601. Free-model 20/50 is documented there and must not be copied into CCR.
- [CITED: https://docs.mistral.ai/resources/error-glossary.md] — a 429 should check `Retry-After`. A separate captured 429 had remaining-req-minute `0` and no reset. That capture is why the 60-second shortcut exists. The capture itself is a GitHub comment, not Mistral's docs.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new package. The behavior depends on files read this session and on ai-gateway 1.0.21 as installed.
- Architecture: HIGH — the one-credential rule and the header-loss rule were read off the installed gateway bundle, not inferred.
- Pitfalls: HIGH for the gateway and the parent cooldown. MEDIUM for Groq duration parsing and OpenRouter millisecond reset, because those are vendor docs.

**Research date:** 2026-11-14
**Valid until:** 2026-12-14 for the code seams. Re-check Groq and OpenRouter header units if those docs move. Re-check the one-credential rule if `@the-next-ai/ai-gateway` is upgraded past 1.0.21.

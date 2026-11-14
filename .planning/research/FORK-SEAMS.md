# Fork seams: automatic class switch

**Saved:** 2026-11-14
**Status:** Locked implementation constraint for milestone v1.0. Shelves, scores, cuts, and step-down stay as in `.planning/research/IMPORTED-DESIGN.md`.
**Parent:** `https://github.com/musistudio/claude-code-router`

This file replaces the earlier "insert a second call inside the request loop and edit `credential-pool.ts`" note in IMPORTED-DESIGN.md. The behavior is the same. The placement is narrower, so a merge from the parent stays small.

## Rule

The parent owns the request loop. This fork owns one new directory. Parent files get a call. When the request is not a Claude class name, or `CCR_CLASS_SWITCH=0`, that call returns the parent's own result.

Do not add a field to `UpstreamAttempt` or to `Router.fallback`. Do not add a key to `config.ts`. Do not use `CUSTOM_ROUTER_PATH`. That hook runs once and can return only a model string. Do not edit `packages/core/src/profiles/service.ts`. The Claude settings door already exists.

## New directory

All milestone code lives in `packages/core/src/class-switch/`. The parent repository does not have this directory, so a merge does not touch it.

| File | Job |
|------|-----|
| `plan.ts` | From a class name, build the ordered attempt list: shelf, score, filters, thin share for near-tied models, step-down |
| `bench.ts` | This fork's bench. 429 until `Retry-After`, else `X-RateLimit-Reset`, else `next_flush_time` / `resets_at`. 401, 403, 404, and 5xx use the durations in IMPORTED-DESIGN.md. A 400 from request shape parks nobody |
| `catalog.ts` | Every 10 minutes, read each provider's model list. No text generation |
| `notice.ts` | One notice while the higher class has no live triple |
| `seam.ts` | The only functions parent files call. The seam list in this document is repeated at the top of `seam.ts` |

Tests live next to these files. Do not edit the parent's test files to hold this behavior.

Kill switch: environment variable `CCR_CLASS_SWITCH=0`. No new config schema. With the switch off, every seam returns the parent behavior, which is how a merge is checked.

## Seams

Each seam is one call. The list below is the whole allowlist of parent files this milestone may edit.

| Parent file | Call | Why |
|-------------|------|-----|
| `packages/core/src/routing/execution-plan.ts`, end of `createRouteExecutionPlan` | Replace the attempt list only when the requested name is a Claude class. Otherwise return the parent plan unchanged. Modes `off`, `retry`, and `model-chain` stay the parent's for every other request | The parent's `fetchUpstreamWithFallback` already walks `attempts` |
| `packages/core/src/gateway/upstream/executor.ts`, the "try the next attempt" condition and the delay before it | A normal request still calls `shouldFallbackAfterStatus` and `retryDelayAfterStatus`. A class request with a shape 400 stops the chain and parks nobody. A class request with 429 uses delay 0. The reset time is stored in `bench.ts`. Claude does not wait out `Retry-After` before the next model | Keeps issue #1843 from walking the whole shelf, and keeps the swap fast |
| Same file, `prepareUpstreamCredentialAttempt` | Filter the credential list. A key that `bench.ts` has parked for this model is skipped. Rotation of the remaining keys stays in the parent | Token choice stays in the parent selector |
| `packages/core/src/gateway/request/pipeline.ts`, next to the existing `clientVisibleResponseModel` | Set `x-ccr-requested-model` and `x-ccr-served-model`. The parent already rewrites the Anthropic response body model to the name Claude sent. Do not copy that rewrite | Issue #1927 and the existing rewrite at `clientVisibleResponseModel` |
| Gateway start and stop | `catalog.start()` / `catalog.stop()` | The catalog walk is outside the request |
| UI, IPC, and `management-server.ts` | One read of `notice.ts` | The banner "Opus is replaced by Sonnet since 15:02". No new screen |

`packages/core/src/providers/credential-pool.ts` stays unchanged. Its 60-second cooldown remains the old path. For a class request, `bench.ts` is the source of truth.

## One request

1. Claude sends `claude-opus-5-5`.
2. `plan.ts` sees class Opus and returns the live triples in order. The parent loop walks that list the same way it walks `model-chain`.
3. The key comes from `prepareUpstreamCredentialAttempt`, minus keys on the bench.
4. A refusal before the first token is the next row of the list. After the first token, the parent loop already returns that response and does not change attempt.
5. An empty shelf is already in the list: Sonnet rows follow, then Haiku. There is no second loop.
6. All four classes empty: the list is empty and Claude receives an error. That is the only error case.

`plan.ts` does not receive the message body. Input is the model name, the tool list, and whether an image is present.

The attempt model string is one the existing model registry already resolves. A slash id such as `nvidia/nemotron-…` stays the model id inside its provider. Do not add a parser that splits on the first slash.

## What this does not do

- It does not re-enter the policy from inside the loop on each refusal. PR #1179 is not the implementation. The ordered list is built once, and the parent loop walks it.
- It does not rewrite `fetchUpstreamWithFallback`.
- It does not change `recordProviderCredentialOutcome` in `credential-pool.ts`.
- It does not assume the parent's credential chain header (`x-ccr-provider-credential-chain`) already switches keys on 429, 401, 403, and 5xx. Parent issue #1923 says an older version did this and then lost it. Phase 2 checks that. If the chain does not switch, the credential filter in `prepareUpstreamCredentialAttempt` is the only extra edit in that function.

Cooldown-table ideas may be copied from [free-llm-proxy-router](https://github.com/kaiser-data/free-llm-proxy-router) (MIT). Catalog-walk ideas may be copied from freellmapi-extended (MIT). The four classes and the cuts 62 / 50 / 28 are not in those projects.

## Merging the parent

Add a remote named `upstream` for `https://github.com/musistudio/claude-code-router`.

Commits for this milestone should be the `class-switch/` directory plus the seam calls above.

On a merge, conflicts belong on those call lines. Take the parent's `fetchUpstreamWithFallback`, credential pool, and config parser whole. After the merge, re-read two sites: the next-attempt condition in `executor.ts`, and the line in `createRouteExecutionPlan` that attaches this fork's list. Run once with `CCR_CLASS_SWITCH=0` and confirm the fork matches the parent on that path.

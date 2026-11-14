# Imported design: automatic class switch

**Source:** Cursor chat `9cf95ff9-5d84-4b2b-adf4-165be1f6ff9b` (2026-11-14).
**Status:** Locked by that chat. Code for this design is not written yet.
**Use:** This file is the source for v1.0 requirements. Do not reopen the four class names, the score cuts, or the "no second router" decision unless the user asks.

## One sentence

CCR is the only door for Claude Code. Claude orders a shelf (a class). CCR picks the strongest live dish on that shelf (a model) and one free cook for that kitchen (a provider token). An empty shelf is replaced by the shelf below. Claude does not see an error. The user sees one notice.

A triple is provider + token + model. Example: OpenRouter, the third of five keys, `nvidia/nemotron-3-ultra-550b-a55b`.

## Door (already in this fork)

On gateway start and on config save, CCR rewrites `~/.claude/settings.json`.

- Set `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_BASE_URL`, and `CLAUDE_AGENT_API_BASE_URL` to the gateway (default `127.0.0.1:3456`).
- Remove Bedrock, Vertex, and Foundry flags, and remove foreign tokens.
- Do not hand-write class names into that file. Clear `ANTHROPIC_DEFAULT_FABLE_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, and `ANTHROPIC_SMALL_FAST_MODEL`, then set them only from profile fields `fableModel`, `opusModel`, `sonnetModel`, `haikuModel`. Empty fields are correct: Claude sends the full model name.

This behavior already lives in `packages/core/src/profiles/service.ts` (`applyProfileConfig`, called from CLI start, Electron start, and config save). Do not rebuild it. Do not regress it.

## Four classes

| Class | Request family | Claude uses it for |
|---|---|---|
| Fable | `claude-fable-…` | longest, hardest tasks |
| Opus | `claude-opus-…` | hard reasoning |
| Sonnet | `claude-sonnet-…` | normal code work |
| Haiku | `claude-haiku-…` | fast and simple tasks, including background |

- `best` is Opus. Claude does that mapping. CCR must treat `best` as Opus.
- `opusplan` is Opus while planning and Sonnet while executing. Claude does that split. CCR must honor the name Claude actually sends on each request.
- `opus[1m]` and `sonnet[1m]` stay in that class, and a model with a window under 1,000,000 tokens is filtered out.

## How a model lands on a shelf

Score from the OpenRouter catalog field `benchmarks.artificial_analysis`.

Weights: `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20. If an index is missing, divide the remaining weights by their sum.

| Class | Score |
|---|---|
| Fable | 62 and above |
| Opus | 50 up to, but not including, 62 |
| Sonnet | 28 up to, but not including, 50 |
| Haiku | below 28 |

- One index only: confidence is low, and the class is not above Sonnet.
- No index, but the id contains a tier word: `fable` / `astra`, `opus` / `sol`, `sonnet` / `terra`, `haiku` / `luna`. The words `flash`, `mini`, `nano`, and `lite` do not set a tier.
- No index and no tier word: no shelf. Same for `:batch` and non-text models (embeddings, OCR, speech, image).
- If the score and the tier word disagree by more than one step, do not shelf the model quietly. Put it in a review queue.
- A new model is classified when the catalog first sees it.

## Tokens

A provider has a list of tokens, not one key. Example: Cursor 2, OpenCode 4, NVIDIA 1, OpenRouter 5. Do not create `cursor` and `cursor2` as two providers.

The live unit is the triple. Quota and key refusal belong to the token. A missing model and a dead kitchen belong to the provider's model.

## How a triple is chosen

Only models in the requested class, after filters.

Filters: the triple is on the bench, the token quota is zero, the request needs tools or images and the model cannot do that, or the request is longer than the model window.

Then sort by score, high to low. Remaining quota and time-to-first-token break a tie only. Almost every request takes the strongest. Neighbors with a close score get a thin share, so their speed stays known and one winner does not eat every 429.

For the chosen model, take the next live token of its provider. Tokens rotate.

A refusal before the first token drops that triple and takes the next. After the first token, the triple stays for the rest of that tool turn. The next user message chooses again.

## Empty shelf

Ladder: Fable, Opus, Sonnet, Haiku. Step down only when the class has no triple that passed the filters. One weak live Opus model beats every Sonnet.

Claude receives a normal success. The picker still shows the name Claude ordered.

The user sees two traces:

- Each such request log says: requested class, served class, model, token, and the reason "no live model in the requested class".
- While the swap holds, one notice, not a stack of warnings: "Opus is replaced by Sonnet since 15:02". When the higher class has a live triple again, the notice goes away.

If all four classes are empty, there is nothing to swap. Claude receives an error. That is the only error case.

## Bench

One table for all sessions.

| What arrived | What sits | How long |
|---|---|---|
| 429 | this token on this model | until `Retry-After`, else until `X-RateLimit-Reset`, else until the time in the body (`next_flush_time`, `resets_at`) |
| 401, no time | this token on every model of that provider | it does not heal itself; check every 5 minutes only to notice a replaced key |
| 403 and `resets_at` is set | this token | until that minute, no extra probes |
| 403 and `resets_at` is empty | this token | do not probe; tell the user to fix it in the provider console |
| 404 | this model on every token | 1 hour |
| 5xx | this model at this provider | 30 seconds |
| 400 from request shape | nobody | the next normal request may use it |

Do not hard-code "how many requests per minute a free model gets". Read the remainder from that response. Groq sends it on success. OpenRouter and Mistral send the time on 429. z.ai writes the quota time in the error (`next_flush_time`).

## Background

A Claude request only reads the table. Two walks and the Claude responses write it.

- Catalog, every 10 minutes. Ask each provider for the model list. No text generation. A new name is classified. A missing name leaves the shelves. This does not spend quota.
- Live check, no fixed 15 minutes. If a model that CCR might serve has no fresh time, send a probe in the next 1–2 minutes. If the provider already named a time, probe at that minute. If the header says a large remainder, do not send an extra probe. A successful Claude turn lifts the triple early. A refusal parks it by the table above.
- A model with zero checks ranks below a confirmed model of the same strength until it answers, or until the background walk checks it.

## Where the code goes

Rules live in one place: class, score, bench, triple choice, notice text. CCR calls that place.

`CUSTOM_ROUTER_PATH` runs once before the request and can return only a model name that is already configured. It cannot retry or pick a token. Do not use it as the whole design.

Insert one hook in the request loop: before the first token, on refusal, call the rules again and pass the triples already tried.

Reuse:

- `packages/core/src/routing/execution-plan.ts` for the attempt loop. Replace the static `fallback.models` list with the dynamic list. The user's current mode is `off`.
- `packages/core/src/providers/credential-pool.ts` and the executor for several keys and pause records. Verify that 429, 401, 403, and 5xx actually move to the next key. Parent issue #1923 says an old version did this and then lost it. Do not assume the fork already does the move.

Cooldown-table ideas may be copied from [free-llm-proxy-router](https://github.com/kaiser-data/free-llm-proxy-router) (MIT). Catalog walk ideas may be copied from freellmapi-extended (MIT). The four classes and the cuts 62 / 50 / 28 are not in those projects.

## Parent issues to respect

Reviewed in the source chat: 1420 issues, 497 pull requests, 19 discussions. Full text was read only for the rows below.

| Keep | Where |
|---|---|
| Attempt loop `off` / `retry` / `model-chain` | already in `execution-plan.ts` |
| Key pool and pause write | already in `credential-pool.ts` |
| Same request, next key, honor `Retry-After`, do not log the key | issue #1923, also #1108, #84, PR #1304. Verify on this fork |
| Response body keeps the requested model | issue #1861, PR #1901 |
| Served model in headers `x-ccr-requested-model` and `x-ccr-served-model` | issue #1927 |
| Error hook for a second call | PR #1179. This is the retry `CUSTOM_ROUTER_PATH` does not have |
| z.ai `next_flush_time` | PR #1926 |
| Images inside `tool_result` survive protocol translation | PR #1958, issue #1678 |
| A log line per attempt leg | PR #1773 |

| Do not | Where |
|---|---|
| Feed the full dialog to the policy. A large thread drops the route script and the fallback never starts | issue #1928, PR #1939 |
| Let a slash id (`openai/gpt-oss-20b`) be split before the kitchen | issue #1920, #1624 |
| Let the UI wipe `CUSTOM_ROUTER_PATH` on save | issue #749 |
| Expect auto mode to get Anthropic `safeguards` from NVIDIA or any other provider. Say so in the same notice | issue #1932 |
| Let a compact-induced 400 kill the chain or bench the model | issue #1843 |
| Let the success card count failed legs as failed requests | issue #1875 |
| Leave Claude with only "gateway broken" when the free model died | issue #1951. The notice is the answer |
| Let `/v1/models` hide the context window so Claude assumes 200k everywhere | issue #1911 |
| Run a fallback leg with the wrong key and get a 401 | issue #1831 |

## What was on the shelves on the morning of 2026-11-14

Snapshot only. Do not treat it as a test fixture that must stay true.

Fable was empty. Opus was `zai/glm-5.3` (59.7) and `zai/glm-5.3-flash` (56.6), both in quota until 2026-11-15 21:41, so an Opus order would step down to Sonnet. Sonnet was Nemotron Ultra (33), then Minimax (29.1, one index). Haiku was the main live pool, with Mistral Medium (26.5) on top while it was in 429. Models with no index, including codestral, magistral, bolt, laguna, and ernie, stayed off the shelves.

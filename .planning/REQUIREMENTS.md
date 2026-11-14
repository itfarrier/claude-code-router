# Requirements: Claude Code Router

**Defined:** 2026-11-14
**Core Value:** Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.

Rules and numbers are locked in `.planning/research/IMPORTED-DESIGN.md` from Cursor chat `9cf95ff9-5d84-4b2b-adf4-165be1f6ff9b`. Chat `c398a042-f199-48a6-afb9-9480889e3f22` compared that chat with this plan. The gaps it found are in the v1 requirements below.

Implementation placement is locked in `.planning/research/FORK-SEAMS.md`. New code goes in `packages/core/src/class-switch/`. Parent files receive only the seam calls listed there. `credential-pool.ts` and the request loop stay the parent's.

## v1 Requirements

### Shelves

- [x] **SHELF-01**: User can send a Claude Code class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, and `best` as Opus) and CCR opens that shelf. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens. The model list Claude reads at `/v1/models` reports each model's real context window, so Claude does not treat every model as 200k (parent issue #1911).
- [x] **SHELF-02**: User can add a provider model and CCR places it on a shelf from OpenRouter `benchmarks.artificial_analysis`. Weights are `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20. If an index is missing, the remaining weights are divided by their sum. Cuts are 62 / 50 / 28. One index cannot place a model above Sonnet. With no index, a tier word in the id sets the class: `fable` or `astra`, `opus` or `sol`, `sonnet` or `terra`, `haiku` or `luna`. `flash`, `mini`, `nano`, and `lite` are not tier words. A hex model id still gets a class from the score or from those words (parent PR #1593).
- [x] **SHELF-03**: User can see models that have no index and no tier word, `:batch` models, and non-text models stay off the shelves. A model whose score and tier word disagree by more than one step waits in a review queue instead of being shelved.

### Choice

- [x] **CHOICE-01**: User can send a class request and CCR serves the highest-scoring triple (provider + token + model) that is not benched, has quota left, supports the request's tools and images, and fits the context. One class name covers many live triples. A model with no successful check ranks below a confirmed model of the same score. An image inside `tool_result` counts as an image and survives protocol translation (parent PR #1958, issue #1678). Near-tied models still receive a thin share of requests.
- [ ] **CHOICE-02**: User can keep several tokens on one provider. CCR rotates the next live token. A refusal before the first token tries the next triple. After the first token, that triple stays until the tool turn ends.

### Bench

- [x] **BENCH-01**: User can have a failure sit out until the provider's own time, on this scope: 429 parks this token on this model until `Retry-After`, else `X-RateLimit-Reset`, else `next_flush_time` / `resets_at`; 401 with no time parks this token on every model of that provider and is rechecked every 5 minutes; 403 with `resets_at` parks this token until that minute; 403 with no time parks this token, is not probed, and the user is told to fix the key; 404 parks this model on every token for 1 hour; 5xx parks this model at this provider for 30 seconds. A 400 from request shape, including a tool-schema mismatch (parent discussion #1493), parks nobody.
- [x] **BENCH-02**: User can rely on quota from that response's headers and error fields. CCR does not ship a hard-coded free-tier requests-per-minute table.

### Background

- [x] **BACK-01**: User can leave CCR running and, every 10 minutes, each provider's model list is refreshed with no text generation. New names are classified. Missing names leave the shelves.
- [x] **BACK-02**: User can have an unclassified-as-live model probed within 1–2 minutes when CCR might serve it and it has no fresh time. If the provider already named a time, the next probe is that time. A large remaining quota skips the extra probe. A successful Claude turn clears the bench early.

### Step-down

- [ ] **FALL-01**: User can request a class with no live triple and still get a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent.
- [ ] **FALL-02**: User can see one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, the reason, and that auto mode will not receive Anthropic `safeguards` from a non-Anthropic provider (parent issue #1932). The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names.
- [ ] **FALL-03**: User receives an error from Claude only when all four classes have no live triple. A live model on a lower class must not surface as "All target providers failed" (parent discussion #1907).

### Safety

- [x] **SAFE-01**: User can send a long Claude thread, including a model id that contains a slash or a hex model id (parent PR #1593), and the class policy still runs. The policy receives the model name, the tool list, and whether an image is present. It returns a parsed triple. It does not receive the message body.
- [ ] **SAFE-02**: User judges whether a class is alive from the bench and the step-down notice, not from the request success card (parent issue #1875). The card counts the user request. A failed leg is its own log line, without the API key.

## Out of Scope

| Feature | Reason |
|---------|--------|
| A second gateway, a rewritten request loop, or an edit to `credential-pool.ts` | New code is `packages/core/src/class-switch/`. Parent files get only the calls in `.planning/research/FORK-SEAMS.md`. |
| A second policy call on each refusal (parent PR #1179) | The source chat named that hook. Fork update cost replaced it: the attempt list is built once, and the parent loop walks it. |
| Editing score weights or class cuts in the UI | Not in the source chat. Weights stay 0.50 / 0.30 / 0.20 and cuts stay 62 / 50 / 28. |
| Approving the review queue from the UI | Not in the source chat. A disagreed model waits in the queue (SHELF-03). No approve or reject screen in v1.0. |
| A gateway-wide proxy setting | Parent discussion #1466 is a proxy on one provider. This milestone does not add it. |
| A side `CUSTOM_ROUTER_PATH` file as the whole design | That hook runs once and cannot pick a token or retry. |
| One provider entry per token | Tokens are a list on one provider. |
| Hard-coded free-tier rate tables | The provider response already carries the time and the remainder. |
| Anthropic `safeguards` on a non-Anthropic provider | Auto mode will not get that field. Say so in the step-down notice. Do not fake the field. |
| Non-text and `:batch` models on the shelves | They are not chat models for Claude Code. |
| Ranking by price or parameter count | The shelf exam is the benchmark score. |
| Rebuilding the Claude settings door | Profile apply, CLI start, and config save already point Claude at CCR and strip Bedrock, Vertex, Foundry, and foreign tokens. |
| A backport bot | Stay on this fork. Keep the diff small enough to merge from `musistudio/claude-code-router` later. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELF-01 | Phase 1 | Complete |
| SHELF-02 | Phase 1 | Complete |
| SHELF-03 | Phase 1 | Pending |
| CHOICE-01 | Phase 2 | Complete |
| CHOICE-02 | Phase 2 | Pending |
| BENCH-01 | Phase 2 | Complete |
| BENCH-02 | Phase 2 | Complete |
| BACK-01 | Phase 1 | Complete |
| BACK-02 | Phase 2 | Complete |
| FALL-01 | Phase 3 | Pending |
| FALL-02 | Phase 3 | Pending |
| FALL-03 | Phase 3 | Pending |
| SAFE-01 | Phase 2 | Complete |
| SAFE-02 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-11-14*
*Last updated: 2026-11-14 after chat c398a042-f199-48a6-afb9-9480889e3f22*

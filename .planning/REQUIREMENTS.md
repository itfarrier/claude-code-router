# Requirements: Claude Code Router

**Defined:** 2026-11-14
**Core Value:** Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.

Rules and numbers are locked in `.planning/research/IMPORTED-DESIGN.md` from Cursor chat `9cf95ff9-5d84-4b2b-adf4-165be1f6ff9b`.

## v1 Requirements

### Shelves

- [ ] **SHELF-01**: User can send a Claude Code class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, and `best` as Opus) and CCR opens that shelf. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens.
- [ ] **SHELF-02**: User can add a provider model and CCR places it on a shelf from OpenRouter `benchmarks.artificial_analysis` (weights `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20; cuts 62 / 50 / 28), or from a tier word in the id when no index exists. One index cannot place a model above Sonnet. `flash`, `mini`, `nano`, and `lite` are not tier words.
- [ ] **SHELF-03**: User can see models that have no index and no tier word, `:batch` models, and non-text models stay off the shelves. A model whose score and tier word disagree by more than one step waits in a review queue instead of being shelved.

### Choice

- [ ] **CHOICE-01**: User can send a class request and CCR serves the highest-scoring triple (provider + token + model) that is not benched, has quota left, supports the request's tools and images, and fits the context. Near-tied models still receive a thin share of requests.
- [ ] **CHOICE-02**: User can keep several tokens on one provider. CCR rotates the next live token. A refusal before the first token tries the next triple. After the first token, that triple stays until the tool turn ends.

### Bench

- [ ] **BENCH-01**: User can have a failed triple sit out until the provider's own time: 429 until `Retry-After` or `X-RateLimit-Reset` or `next_flush_time` / `resets_at`; 401 with no time is rechecked every 5 minutes; 403 with `resets_at` waits until that minute; 403 with no time is not probed and the user is told to fix the key; 404 sits for 1 hour; 5xx sits for 30 seconds. A 400 from request shape sits nobody out.
- [ ] **BENCH-02**: User can rely on quota from that response's headers and error fields. CCR does not ship a hard-coded free-tier requests-per-minute table.

### Background

- [ ] **BACK-01**: User can leave CCR running and, every 10 minutes, each provider's model list is refreshed with no text generation. New names are classified. Missing names leave the shelves.
- [ ] **BACK-02**: User can have an unclassified-as-live model probed within 1–2 minutes when CCR might serve it and it has no fresh time. If the provider already named a time, the next probe is that time. A large remaining quota skips the extra probe. A successful Claude turn clears the bench early.

### Step-down

- [ ] **FALL-01**: User can request a class with no live triple and still get a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent.
- [ ] **FALL-02**: User can see one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, and the reason. The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names.
- [ ] **FALL-03**: User receives an error from Claude only when all four classes have no live triple.

### Safety

- [ ] **SAFE-01**: User can send a long Claude thread, including model ids that contain a slash, and the class policy still runs. The policy receives the model name, the tool list, and whether an image is present. It returns a parsed triple. It does not receive the message body.
- [ ] **SAFE-02**: User can see the request success card count the user request, not each failed attempt leg. A failed leg is still recorded on its own log line, without the API key.

## v2 Requirements

### Tuning

- **TUNE-01**: User can change score weights and class cuts in the management UI
- **TUNE-02**: User can approve or reject a model that is waiting in the review queue

## Out of Scope

| Feature | Reason |
|---------|--------|
| A second gateway or a rewritten router | The attempt loop and the credential pool already exist. Insert the dynamic list there. |
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
| SHELF-01 | — | Pending |
| SHELF-02 | — | Pending |
| SHELF-03 | — | Pending |
| CHOICE-01 | — | Pending |
| CHOICE-02 | — | Pending |
| BENCH-01 | — | Pending |
| BENCH-02 | — | Pending |
| BACK-01 | — | Pending |
| BACK-02 | — | Pending |
| FALL-01 | — | Pending |
| FALL-02 | — | Pending |
| FALL-03 | — | Pending |
| SAFE-01 | — | Pending |
| SAFE-02 | — | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-11-14*
*Last updated: 2026-11-14 after initial definition*

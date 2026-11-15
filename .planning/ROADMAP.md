# Roadmap: Claude Code Router

## Overview

Claude Code orders a class. This milestone makes CCR put each model on the right shelf, serve the strongest live provider, token, and model for that class, and still return a Claude success when the shelf is empty. The user sees one notice for that swap. The Claude settings door is already validated and is not a phase.

Code placement is locked in `.planning/research/FORK-SEAMS.md`. Phases add `packages/core/src/class-switch/` and the seam calls. They do not rewrite the parent request loop or `credential-pool.ts`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Shelves** - Models land on the right class shelf, and the catalog refresh keeps them there (completed 2026-11-15)
- [x] **Phase 2: Live choice** - A class request gets the strongest live triple (completed 2026-11-15)
- [ ] **Phase 3: Step-down** - An empty shelf still succeeds, and the user sees one notice

## Phase Details

### Phase 1: Shelves
**Goal**: Models land on the right class shelf, and a catalog refresh keeps those shelves current.
**Depends on**: Nothing (first phase)
**Requirements**: SHELF-01, SHELF-02, SHELF-03, BACK-01
**Success Criteria** (what must be TRUE):
  1. User sends a Claude class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, or `best`) and CCR opens that shelf. `best` opens Opus. A name Claude sends for `opusplan` opens Opus or Sonnet as sent. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens. `/v1/models` reports each model's real context window, so Claude does not treat every model as 200k.
  2. User adds a provider model and CCR places it from OpenRouter `benchmarks.artificial_analysis` (weights `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20; cuts 62 / 50 / 28). A missing index divides the remaining weights by their sum. One index cannot place a model above Sonnet. With no index, the tier words are `fable`/`astra`, `opus`/`sol`, `sonnet`/`terra`, and `haiku`/`luna`. `flash`, `mini`, `nano`, and `lite` do not set a tier. A hex model id still gets a class from the score or from those words.
  3. User can see that a model with no index and no tier word, a `:batch` model, or a non-text model stays off the shelves. A model whose score and tier word disagree by more than one step waits in the review queue and is not shelved.
  4. User leaves CCR running and, every 10 minutes, each provider's model list refreshes with no text generation. A new name is classified. A missing name leaves the shelves.
**Plans:** 3/3 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Open a class shelf from the end of createRouteExecutionPlan

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Place a model by score, tier word, exclusion, and review distance

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Refresh shelves every 10 minutes and report the real context window

### Phase 2: Live choice
**Goal**: A class request is served by the strongest live triple, and a refusal before the first token tries the next one.
**Depends on**: Phase 1
**Requirements**: CHOICE-01, CHOICE-02, BENCH-01, BENCH-02, BACK-02, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. User sends a class request and CCR serves the highest-scoring triple that is not benched, has quota left, supports the request's tools and images, and fits the context. One class name covers many live triples. A model with no successful check ranks below a confirmed model of the same score. An image inside `tool_result` counts as an image and survives protocol translation. Near-tied models still receive a thin share of requests.
  2. User keeps several tokens on one provider. CCR rotates to the next live token. A refusal before the first token tries the next triple. After the first token, that triple stays until the tool turn ends. The user judges whether a class is alive from the bench and the step-down notice, not from the success card. The card counts the user request. A failed leg is logged on its own line without the API key.
  3. A failure sits out on the source-chat scope: 429 parks this token on this model until `Retry-After`, else `X-RateLimit-Reset`, else `next_flush_time` / `resets_at`; 401 with no time parks this token on every model of that provider and is rechecked every 5 minutes; 403 with `resets_at` parks this token until that minute; 403 with no time is not probed and the user is told to fix the key; 404 parks this model on every token for 1 hour; 5xx parks this model at this provider for 30 seconds. A 400 from request shape, including a tool-schema mismatch, parks nobody. Quota comes from that response, not a hard-coded free-tier table.
  4. User can have a model that CCR might serve, and that has no fresh time, probed within 1–2 minutes. If the provider already named a time, the next probe is that time. A large remaining quota skips the extra probe. A successful Claude turn clears the bench early.
  5. User sends a long Claude thread, including a model id that contains a slash or a hex model id, and the class policy still runs. The policy receives the model name, the tool list, and whether an image is present. It returns a parsed triple. It does not receive the message body.
**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Park a higher-score model and serve the next model on that shelf

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Park from the provider clock and probe one shelf model

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Filter, sort, and lift images for the live triples

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Send one credential and continue a class refusal at once

### Phase 3: Step-down
**Goal**: An empty shelf still returns a Claude success from the next lower class, and the user sees one notice until that class is live again.
**Depends on**: Phase 2
**Requirements**: FALL-01, FALL-02, FALL-03
**Success Criteria** (what must be TRUE):
  1. User requests a class with no live triple and still gets a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent.
  2. User sees one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, the reason, and that auto mode will not receive Anthropic `safeguards` from a non-Anthropic provider. The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names.
  3. User receives an error from Claude only when all four classes have no live triple. A live model on a lower class does not surface as "All target providers failed".
**Plans:** 4 plans (3/3 executed; 03-04 gap closure pending)
**UI hint**: yes

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Serve lower-class Claude success and record the swap

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Expose the swap notice through desktop IPC and authenticated web RPC

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Render the persistent banner and request-log step-down details

**Wave 4** *(gap closure; blocked on Wave 3 completion)*
- [ ] 03-04-PLAN.md — Persist and render the real class-switch reason from production route traces

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shelves | 3/3 | Complete    | 2026-11-15 |
| 2. Live choice | 4/4 | Complete    | 2026-11-15 |
| 3. Step-down | 3/3 | In Progress | - |

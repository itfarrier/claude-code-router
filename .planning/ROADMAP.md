# Roadmap: Claude Code Router

## Overview

Claude Code orders a class. This milestone makes CCR put each model on the right shelf, serve the strongest live provider, token, and model for that class, and still return a Claude success when the shelf is empty. The user sees one notice for that swap. The Claude settings door is already validated and is not a phase.

Code placement is locked in `.planning/research/FORK-SEAMS.md`. Phases add `packages/core/src/class-switch/` and the seam calls. They do not rewrite the parent request loop or `credential-pool.ts`.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Shelves** - Models land on the right class shelf, and the catalog refresh keeps them there
- [ ] **Phase 2: Live choice** - A class request gets the strongest live triple
- [ ] **Phase 3: Step-down** - An empty shelf still succeeds, and the user sees one notice

## Phase Details

### Phase 1: Shelves
**Goal**: Models land on the right class shelf, and a catalog refresh keeps those shelves current.
**Depends on**: Nothing (first phase)
**Requirements**: SHELF-01, SHELF-02, SHELF-03, BACK-01
**Success Criteria** (what must be TRUE):
  1. User sends a Claude class name (`claude-fable-…`, `claude-opus-…`, `claude-sonnet-…`, `claude-haiku-…`, or `best`) and CCR opens that shelf. `best` opens Opus. A name Claude sends for `opusplan` opens Opus or Sonnet as sent. `opus[1m]` and `sonnet[1m]` stay in that class and drop any model whose window is under 1,000,000 tokens.
  2. User adds a provider model and CCR places it from OpenRouter `benchmarks.artificial_analysis` (weights `coding_index` 0.50, `agentic_index` 0.30, `intelligence_index` 0.20; cuts 62 / 50 / 28), or from a tier word in the id when no index exists. One index cannot place a model above Sonnet. `flash`, `mini`, `nano`, and `lite` do not set a tier.
  3. User can see that a model with no index and no tier word, a `:batch` model, or a non-text model stays off the shelves. A model whose score and tier word disagree by more than one step waits in the review queue and is not shelved.
  4. User leaves CCR running and, every 10 minutes, each provider's model list refreshes with no text generation. A new name is classified. A missing name leaves the shelves.
**Plans**: TBD

### Phase 2: Live choice
**Goal**: A class request is served by the strongest live triple, and a refusal before the first token tries the next one.
**Depends on**: Phase 1
**Requirements**: CHOICE-01, CHOICE-02, BENCH-01, BENCH-02, BACK-02, SAFE-01, SAFE-02
**Success Criteria** (what must be TRUE):
  1. User sends a class request and CCR serves the highest-scoring triple that is not benched, has quota left, supports the request's tools and images, and fits the context. Near-tied models still receive a thin share of requests.
  2. User keeps several tokens on one provider. CCR rotates to the next live token. A refusal before the first token tries the next triple. After the first token, that triple stays until the tool turn ends. The success card counts the user request, not each failed attempt leg, and a failed leg is logged on its own line without the API key.
  3. User can have a failed triple sit out until the provider's own time: 429 until `Retry-After` or `X-RateLimit-Reset` or `next_flush_time` / `resets_at`; 401 with no time is rechecked every 5 minutes; 403 with `resets_at` waits until that minute; 403 with no time is not probed and the user is told to fix the key; 404 sits for 1 hour; 5xx sits for 30 seconds. A 400 from request shape sits nobody out. Quota comes from that response's headers and error fields, not a hard-coded free-tier table.
  4. User can have a model that CCR might serve, and that has no fresh time, probed within 1–2 minutes. If the provider already named a time, the next probe is that time. A large remaining quota skips the extra probe. A successful Claude turn clears the bench early.
  5. User sends a long Claude thread, including a model id that contains a slash, and the class policy still runs. The policy receives the model name, the tool list, and whether an image is present. It returns a parsed triple. It does not receive the message body.
**Plans**: TBD

### Phase 3: Step-down
**Goal**: An empty shelf still returns a Claude success from the next lower class, and the user sees one notice until that class is live again.
**Depends on**: Phase 2
**Requirements**: FALL-01, FALL-02, FALL-03
**Success Criteria** (what must be TRUE):
  1. User requests a class with no live triple and still gets a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent.
  2. User sees one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, and the reason. The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names.
  3. User receives an error from Claude only when all four classes have no live triple.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shelves | 0/TBD | Not started | - |
| 2. Live choice | 0/TBD | Not started | - |
| 3. Step-down | 0/TBD | Not started | - |

# Claude Code Router

## What This Is

Claude Code Router (CCR) is a local control plane for coding agents. Agents keep one gateway URL. CCR chooses the provider, model, credential, and protocol behind that URL. The desktop app, the `ccr` CLI, and the Docker image run the same core.

## Core Value

Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.

## Current Milestone: v1.0 Automatic class switch

**Goal:** When Claude Code asks for Fable, Opus, Sonnet, or Haiku, CCR serves the strongest live provider, token, and model on that shelf, steps down one class only when the shelf is empty, and tells the user about the swap.

**Target features:**
- Four shelves that match Claude Code class names, filled by a public benchmark score or by a tier word in the model id
- Choice of the strongest live triple (provider + token + model), with token rotation and a retry before the first token
- A bench that parks failures until the provider's own reset time
- A background catalog refresh and a probe that does not burn quota when the provider already says the model is fine
- A transparent step-down: Claude still sees the name it asked for, and the user sees one notice

## Requirements

### Validated

- ✓ One local gateway, with CLI, desktop, and Docker on the same core — existing product
- ✓ Several API keys on one provider, with cooldown read and write in `packages/core/src/providers/credential-pool.ts` — existing product
- ✓ A static fallback plan with modes `off`, `retry`, and `model-chain` in `packages/core/src/routing/execution-plan.ts` — existing product
- ✓ Claude Code settings are pointed at the gateway on profile apply, CLI start, and config save. The three base URLs are set, Bedrock, Vertex, and Foundry flags are removed, and class env vars come only from profile fields — `packages/core/src/profiles/service.ts`
- ✓ A Claude class request selects one shelf, including `best`, `opusplan`, and the `[1m]` window filter — Phase 1
- ✓ New catalog models land on a shelf by score, or stay off the shelf when the rule says so — Phase 1
- ✓ CCR serves the strongest live triple and retries the next triple before the first token — Phase 2
- ✓ Failures sit on the bench until the provider's own time, not a hard-coded free-tier limit — Phase 2
- ✓ The policy sees a small input and returns a parsed triple. A request-shape 400 does not bench the model — Phase 2
- ✓ An empty shelf steps down. Claude gets a success from the next lower class. The user sees one notice until that class is live again — Phase 3

### Active

- (none — all v1.0 milestone requirements validated)

### Out of Scope

- A second gateway or a rewrite of the request loop or `credential-pool.ts` — new code lives in `packages/core/src/class-switch/`. Parent files get only the calls in `.planning/research/FORK-SEAMS.md`
- A side policy file that only picks the first model — it cannot rotate tokens or step down after a refusal
- One provider entry per token (`cursor` and `cursor2`) — tokens stay on one provider
- Hard-coded requests-per-minute tables for free models — read the headers and error fields of that response
- Anthropic `safeguards` for auto mode on a non-Anthropic provider — name it in the notice, do not invent the field
- Non-text models and `:batch` models on the shelves — embeddings, OCR, speech, and images stay off
- Ranking by price or parameter count — the exam is the benchmark score
- A backport bot for the parent repo — stay on this fork and keep parent merges possible

## Context

This milestone comes from Cursor chat `9cf95ff9-5d84-4b2b-adf4-165be1f6ff9b`. The locked product rules are in `.planning/research/IMPORTED-DESIGN.md`. The locked way to place that code, so this fork can take updates from `musistudio/claude-code-router`, is in `.planning/research/FORK-SEAMS.md`. Domain research was not run again. The chat already compared this fork, freellm, and zerogateway, and it reviewed the parent GitHub issues and pull requests.

The product version on `package.json` is 3.1.3. That is not the GSD milestone version. This is the first GSD milestone, so it is v1.0.

Upstream notes that the implementation must respect:

- Do not send the full dialog body into a route script. A long Claude thread drops the script, and the fallback then never runs (parent issue #1928).
- Do not return a `provider/model` string that the parser will split again. OpenRouter and NVIDIA ids contain a slash (parent issue #1920).
- Keep the requested model name in the response body. Put the served model in `x-ccr-requested-model` and `x-ccr-served-model` (parent issue #1927).
- A 400 from request shape, including managed compact stripping `max_tokens`, must not park the model (parent issue #1843).
- The success card must not count a failed attempt leg as a failed user request (parent issue #1875).
- z.ai quota time is `next_flush_time` (parent PR #1926). Do not parse that time out of free text.

Config mode is `yolo`. Granularity is `coarse`. Phase numbers start at 1 because this repo has no earlier GSD phases.

## Constraints

- **Codebase**: Put class, score, bench, catalog, and notice code in `packages/core/src/class-switch/`. Touch a parent file only through a seam in `.planning/research/FORK-SEAMS.md`. Leave `credential-pool.ts`, `profiles/service.ts`, and `config.ts` unchanged.
- **Parent**: The git parent is `musistudio/claude-code-router`. Merge by taking the parent's request loop whole. `CCR_CLASS_SWITCH=0` must match parent behavior.
- **Runtime**: Node `>=22`. Domain code stays in `packages/core`. The UI talks only through `window.ccr`.
- **Claude identity**: The response body keeps the model name Claude sent. The picker in Claude still shows that name.
- **Policy input**: Model name, tool list, and whether the request has an image. Not the message body.
- **Door**: Do not regress the existing Claude settings rewrite.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Four classes: Fable, Opus, Sonnet, Haiku | They match Claude Code aliases. The user confirmed this split. | ✓ Shipped Phase 1 (shelf matching) |
| Score weights 0.50 / 0.30 / 0.20 and cuts 62 / 50 / 28 | Locked in the imported chat. Coding index, then agentic index, then intelligence index, from OpenRouter `benchmarks.artificial_analysis`. | ✓ Shipped Phase 1 (catalog scoring) |
| Dynamic attempt list at the end of `createRouteExecutionPlan`, not a second loop | The parent `fetchUpstreamWithFallback` already walks `attempts`. A class request replaces that list. Other requests keep `off`, `retry`, and `model-chain`. See `.planning/research/FORK-SEAMS.md`. | ✓ Shipped Phase 2 (live triple walk) |
| Provider reset time, not a fixed 15-minute probe or a 1-day park | The user rejected fixed probe and park timers. Catalog refresh stays at 10 minutes. | ✓ Shipped Phase 2 (bench clocks) |
| Stay on this fork, code in `packages/core/src/class-switch/` | A side `CUSTOM_ROUTER_PATH` file cannot rotate tokens or step down after a refusal. Editing the parent loop in place makes every upstream merge a rewrite. | ✓ Shipped Phase 3 (step-down shipped inside the seam boundaries) |
| Source-chat gaps from chat `c398a042-f199-48a6-afb9-9480889e3f22` are in the v1 requirements | Weight renormalization, tier words, bench scope, an unchecked model ranking below a confirmed one, `safeguards` in the notice, `tool_result` images, and the real `/v1/models` window were only in IMPORTED-DESIGN.md. Phase criteria now say them too. PR #1179 stays superseded by FORK-SEAMS.md. | ✓ Shipped Phases 1–3 (safeguards named in the notice; never invented) |
| Step-down appends lower-class rows to the same parent attempt list; no second loop | Ordered append: requested rows first, then lower classes, so refusals fall through; full exhaustion returns an empty list and the parent behavior stands. One seam capture writes the real notice reason into the existing routeTrace. | ✓ Shipped Phase 3 |
| Skip a second research pass | Chat `9cf95ff9-5d84-4b2b-adf4-165be1f6ff9b` is the locked design. | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-15 after Phase 3*

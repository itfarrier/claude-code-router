# Claude Code Router

## What This Is

Claude Code Router (CCR) is a local control plane for coding agents. Agents keep one gateway URL. CCR chooses the provider, model, credential, and protocol behind that URL. The desktop app, the `ccr` CLI, and the Docker image run the same core.

## Core Value

Claude Code orders a class. CCR serves the strongest live model in that class, and Claude does not fail when that class is empty.

## Current Milestone: v1.1 Per-provider SOCKS5 proxies

**Goal:** Each provider can declare its own SOCKS5 proxy or direct egress; provider-bound outbound traffic follows it, and providers without their own setting keep the global upstream proxy unchanged.

**Target features:**
- A per-provider proxy setting on the provider config entry (config file + provider editor in the UI): a `socks5://` or `socks5h://` URL with username/password auth, or `direct`
- Native SOCKS5 dispatch in the core fetch path, with DNS resolved at the proxy (socks5h semantics) — today `parseProxyServerEndpoint` rejects `socks://` and undici speaks HTTP-CONNECT only
- Provider-bound egress follows the provider's own proxy: router upstream attempts, the per-provider model catalog/probe refresh, and provider token/account endpoints
- Fallback chain: provider proxy → explicit `direct` → global `proxy.upstream` → env proxy → system proxy. A provider without the setting behaves exactly as today
- The proxy decision for a request is observable in the existing route trace / request log

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

- [ ] Each provider entry can declare its own socks5/socks5h proxy URL with auth, or direct egress
- [ ] Provider-bound egress (attempts, catalog/probe, token endpoints) resolves through the provider's own proxy
- [ ] Native SOCKS5 dispatch with DNS at the proxy replaces the local HTTP-CONNECT shim workaround
- [ ] The provider editor UI exposes the per-provider proxy setting
- [ ] The chosen proxy per request is visible in the route trace / request log

### Out of Scope

- A second gateway or a rewrite of the request loop or `credential-pool.ts` — new code lives in `packages/core/src/class-switch/`. Parent files get only the calls in `.planning/research/FORK-SEAMS.md`
- A side policy file that only picks the first model — it cannot rotate tokens or step down after a refusal
- One provider entry per token (`cursor` and `cursor2`) — tokens stay on one provider
- Hard-coded requests-per-minute tables for free models — read the headers and error fields of that response
- Anthropic `safeguards` for auto mode on a non-Anthropic provider — name it in the notice, do not invent the field
- Non-text models and `:batch` models on the shelves — embeddings, OCR, speech, and images stay off
- Ranking by price or parameter count — the exam is the benchmark score
- A backport bot for the parent repo — stay on this fork and keep parent merges possible
- socks4 support — the stack has no socks4 endpoint; socks5/socks5h only
- A proxy per credential or per model inside one provider — the provider entry is the unit
- Non-provider egress (media, plugins, MCP discovery, hosted web-search) — stays on the global upstream proxy
- A new standalone proxy UI screen — one field group in the existing provider editor
- A proxy health monitor or latency ranking of proxies — the operator picks the proxy per provider

## Context

This milestone comes from opencode session `ses_e20334c28ffeM6i21SDXZ2b0Mn` (2026-11-15/16) and the stack notes in `~/.claude-code-router/README.md` and `PROGRESS.md`. The locked v1.0 rules are in `.planning/research/IMPORTED-DESIGN.md` and `.planning/research/FORK-SEAMS.md`.

**Egress history:** every CCR provider egresses through ONE SOCKS5 proxy (exit Gdynia PL) via a local HTTP-CONNECT shim (`~/bin/socks-http-shim.py`, port 8899) — CCR's undici rejects `socks://` URLs and speaks HTTP-CONNECT only. A NO_PROXY split-egress experiment (2026-11-13) was REVERTED: direct egress broke intermittently because `api.z.ai` advertises AAAA records and the local IPv6 route is dead. groq, modelscope, and cursor require the PL tunnel (BY-IP blocks); the rest tolerate it. Per-provider socks5h (DNS at the proxy) removes both the shim and the fragile hostname split.

The product version on `package.json` is 3.1.3. That is not the GSD milestone version. GSD milestones: v1.0 shipped 2026-11-15; this is v1.1. Phase numbers continue from 4.

Upstream notes that the implementation must respect:

- Do not send the full dialog body into a route script. A long Claude thread drops the script, and the fallback then never runs (parent issue #1928).
- Do not return a `provider/model` string that the parser will split again. OpenRouter and NVIDIA ids contain a slash (parent issue #1920).
- Keep the requested model name in the response body. Put the served model in `x-ccr-requested-model` and `x-ccr-served-model` (parent issue #1927).
- A 400 from request shape, including managed compact stripping `max_tokens`, must not park the model (parent issue #1843).
- The success card must not count a failed attempt leg as a failed user request (parent issue #1875).
- z.ai quota time is `next_flush_time` (parent PR #1926). Do not parse that time out of free text.

Config mode is `yolo`. Granularity is `coarse`. Phase numbers start at 1 because this repo has no earlier GSD phases.

**Shipped v1.0 "Automatic class switch" (2026-11-15):** 3 phases, 11 plans, 24 tasks — 122 commits, 108 files, +19,344/−220. All class-switch code lives in `packages/core/src/class-switch/` behind the FORK-SEAMS seams; every parent-file edit is a recorded seam call. All 14 v1 requirements validated (33/33, 25/25 + 1 designed supersession, 49/49 verification truths; 0 open security threats across 3 registers; Nyquist compliant ×3). Carried to the next milestone backlog: 14 pre-existing `npm run typecheck` errors in FORK-SEAMS-locked parent files, the build-regenerates-`models.json` hazard, intermittent plugin/timing test flakes, the latent CDN-catalog-cache shadow, and the unhardened thin-share advisory.

## Constraints

- **Codebase**: New proxy code lives in a new `packages/core/src/` directory (name set by the phase plan). Parent files get seam calls only, in the FORK-SEAMS way. Do not rewrite the request loop, `credential-pool.ts`, or the Claude settings door. `fetchWithSystemProxy` semantics for providers without a per-provider setting must not change.
- **Parent**: The git parent is `musistudio/claude-code-router`. Merge by taking the parent's request loop whole. A kill switch in the FORK-SEAMS style must make the fork match parent behavior.
- **Runtime**: Node `>=22`. Domain code stays in `packages/core`. The UI talks only through `window.ccr`.
- **Socks**: `socks5://` and `socks5h://` with username/password auth. DNS resolves at the proxy. No socks4.
- **Operations (user rules for this milestone)**: If CCR is run during implementation for a check, kill it and every related process/thread afterwards — nothing stays in memory. Run all helper processes at the lowest priority. Every system setting changed during work is written down with how to revert it.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Per-provider proxy declared on the provider config entry; the global upstream proxy stays the default | The operator picks per provider; an entry without the field behaves exactly as today | — Pending |
| socks5 + socks5h with auth, DNS resolved at the proxy | The 2026-11-13 NO_PROXY revert showed local DNS and dead IPv6 routes break direct egress; socks5h resolves at the proxy | — Pending |
| Config file + provider editor UI field | CLI, desktop, and Docker users all configure providers today; both surfaces | — Pending |
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
*Last updated: 2026-11-16 after v1.1 milestone start (per-provider SOCKS5 proxies)*

# Milestones

## v1.0 Automatic class switch (Shipped: 2026-11-15)

**Phases completed:** 3 phases, 11 plans, 24 tasks

**Key accomplishments:**
- Scored class shelves replace route attempts via `applyShelf` on `createRouteExecutionPlan`, with SHELF-01 parsing and SHELF-02 sort on disk snapshot rows.
- `classifyModel` shelves, excludes, or queues models from AA scores, tier tokens, `:batch`, non-text rules, and score–tier distance; `matchOpenRouterModel` attaches at most one OpenRouter row.
- Real `context_window` on `/v1/models` plus a 10-minute `mode: models` shelf walk that seeds, classifies, and retains rows on probe failure.
- Class 5xx parks provider+model in memory (30s), filters shelf rows in `attemptsForClass`, and passes tool/image/token scalars through `createRouteExecutionPlan` without the message body.
- Class-switch bench rows now follow upstream clocks and quota headers; a separate connectivity timer probes one shelf model when due.
- One shelf call filters and sorts live provider/model rows, rotates a near-tie every twentieth list, duplicates rows per credential, remembers tool-turn triples, and lifts images out of tool_result.
- The upstream loop sends one live credential per class row, continues pre-token refusals at delay 0, stops on 400, and skips the parent 60s cooldown for class legs.
- An empty Opus shelf now serves a normal Claude success from Sonnet through the existing executor: the body keeps `claude-opus-4-6`, paired `x-ccr-requested-model`/`x-ccr-served-model` headers name the swap, and one process-local notice describes it until the requested class is live again.
- The single current swap notice now crosses every host through one typed zero-argument read: authenticated management RPC, Electron IPC channel `ccr:app:get-swap-notice`, preload, `Window.ccr`, and the browser bridge — all calling the same `notice.ts` seam, with no new route, write API, or second state store.
- While a swap holds, one polite non-dismissible amber banner mounts below the startup error banner on every main view (polled through the existing 2s runtime cycle), and every derivable step-down request row shows a fixed-face SD pill plus an expanded amber detail block — all from existing RequestLogEntry fields, with English and zh copy.
- A real lower-class 2xx now persists one marked class-switch routeTrace decision with the actual SwapNotice.reason, and the unmodified expanded management log displays that production Reason — closing verification check 49 without touching the WR-02 selector.

**Known verification overrides: 9 newly acknowledged, 0 carried forward** — 3 UAT sections (all passed, 0 pending scenarios, acknowledged at close) and 6 deferred items from the phase-03 ledger (intermittent plugin test flakes, latent CDN-catalog-cache shadow, 14 pre-existing typecheck errors in FORK-SEAMS-locked parent files, pre-existing uncommitted working-tree drift, opt-in wire-test gates, build-regenerates-models.json hazard). Full register: `.planning/STATE.md` Deferred Items table.

---

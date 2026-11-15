# Phase 3 Deferred Items

Logged by the wave-1 post-merge fix run (2026-11-15). These discoveries were
verified but are OUT OF SCOPE for the 4-failure fix wave — do not fix them here.

## 1. Intermittent pre-existing plugin test failures

- `packages/core/test/unit/config/plugin-config-migration.test.mjs` (2 tests) and
  `packages/core/test/unit/agents/plugin-permissions.test.mjs` (1 test, "known
  bundled plugins without persisted permissions receive scoped defaults").
- Documented as failing in the 03-01 GREEN unit run (995/1000), but they PASSED in
  both post-fix verification runs (full core scope 1250/1260 pass / 0 fail, unit
  scope 998/1000 / 0 fail). They are intermittent and pre-date phase 3. Left as
  documented; do not chase in this wave.

## 2. Latent: runtime-data-dir CDN cache shadows the repo catalog

- `packages/core/src/models/catalog-file.ts` resolves catalog candidates in
  order: env overrides, then `<runtime-data-dir>/cache/models.json`, then the
  repo `packages/core/models.json`. `management-server.ts:137` calls
  `await refreshModelCatalog()` at startup, which downloads
  `https://models.ccrdesk.top/models.json` and writes that cache file into the
  test runner's SHARED temp home (`run-tests.mjs` gives the whole core run one
  HOME). Any test that boots the real management server therefore shadows the
  repo catalog for every later catalog read in the run.
- Today this is latent only: the live CDN payload is byte-for-data identical to
  the committed `models.json` (same generatedAt 2026-10-09T11:34:15.192Z, same
  modelCount 5092), so reads through the cache and reads through the repo file
  agree. When the CDN publishes newer data, catalog-asserting tests will start
  failing again whenever a management-server test runs first.

## 3. Pre-existing `npm run typecheck` failures (added 2026-11-15 by 03-02)

- `npm run typecheck` exits 2 with 14 errors. Proven pre-existing via a HEAD
  worktree probe: the identical error set exists at `b11f731b` (the last
  phase-2 fix commit, before any 03-01 code) and at `e9f19965`. No phase-1/2/3
  plan used typecheck as a gate, so this never surfaced.
- Files: `packages/core/src/gateway/upstream/executor.ts` (10), `packages/core/src/routing/execution-plan.ts` (1),
  `packages/core/src/class-switch/bench.ts` (2), `packages/core/src/class-switch/plan.ts` (1).
- 03-02's Task 3 verify lists `npm run typecheck` (fails_when exit != 0). That
  gate is unachievable within the fork-seam boundary: 11 of the 14 errors sit
  in locked parent files (`executor.ts`, `execution-plan.ts`) that
  `.planning/research/FORK-SEAMS.md` forbids editing beyond the recorded seam
  calls. Files this plan touched contribute ZERO typecheck errors. Recorded in
  the WINDOWS ledger (entries 2-5 lint-warning, entry 6 deviation); fixing
  requires a deliberate parent-file type cleanup outside the seam map.
- Proper fix (future wave): make catalog-reading tests hermetic by pinning
  `CCR_MODEL_CATALOG_PATH` to a fixture, or point the suite's
  `CCR_MODEL_CATALOG_URL` at a stub server.

## 3. Uncommitted working-tree drift present before this fix wave

- `package.json`: added `allowScripts: { "better-sqlite3@12.11.1": true }`.
- `.planning/config.json` / `.planning/state.json`: planning-state rewrites.
- `packages/core/models.json` HAD an uncommitted regeneration (generatedAt
  2026-11-15T09:45:34.051Z, modelCount 6335). That regeneration was the root
  cause of three of the four gate failures; it was restored to HEAD as part of
  this wave (see below), so it is no longer drift.
- These remaining files were deliberately left uncommitted by the fix wave.

## 4. Wire tests skip without CCR_TEST_GATEWAY_ENTRY

- `october-issues-wire.test.mjs` (3 tests) and `recent-issues-wire.test.mjs`
  skip unless `CCR_TEST_GATEWAY_ENTRY` points at the gateway production entry.
  Pre-existing behavior; the 10 skipped tests in the core run are these plus
  similar opt-in gates.

## §4 — Wave-2 gate finding: build regenerates the tracked models.json from live sources (2026-11-15)

`build/build.mjs` line 1 imports `scripts/generate-models-json.mjs`, so every run of the root
`build` script (and `build/docker-build.mjs`) regenerates `packages/core/models.json` from LIVE
litellm/models.dev sources. The file is git-tracked and the catalog tests assert against HEAD's
snapshot, so any build run leaves uncommitted drift that fails codex-model-catalog,
openrouter-compatibility (#1779 aggregate source), and provider-probe (NVIDIA source record)
tests until `git checkout HEAD -- packages/core/models.json`.

- Occurrences in this phase: 2026-11-15T09:45 (wave-1 window) and 10:27 (orchestrator wave-2 build gate), both restored to HEAD.
- Mitigation used during this phase: the post-merge BUILD gate runs `node build/build.mjs` NO MORE —
  the full TEST gate (npm run test:packages && npm run test:architecture) compiles everything it needs
  and is the authoritative gate; models.json is restored to HEAD and left untouched.
- Proper fix belongs to the repo design (upstream): generate to a gitignored path or stop importing
  the generator from build.mjs; left for the milestone audit as tech debt.

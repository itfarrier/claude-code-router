---
phase: 02-live-choice
verified: 2026-11-15T14:11:25Z
status: passed
score: 25/25 must-haves verified
covered_files: [".planning/phases/02-live-choice/02-01-PLAN.md", ".planning/phases/02-live-choice/02-01-SUMMARY.md", ".planning/phases/02-live-choice/02-02-PLAN.md", ".planning/phases/02-live-choice/02-02-SUMMARY.md", ".planning/phases/02-live-choice/02-03-PLAN.md", ".planning/phases/02-live-choice/02-03-SUMMARY.md", ".planning/phases/02-live-choice/02-04-PLAN.md", ".planning/phases/02-live-choice/02-04-SUMMARY.md", "packages/core/src/class-switch/bench.ts", "packages/core/src/class-switch/plan.ts", "packages/core/src/class-switch/seam.ts", "packages/core/src/gateway/model-catalog.ts", "packages/core/src/gateway/request/pipeline.ts", "packages/core/src/gateway/upstream/executor.ts", "packages/core/src/routing/execution-plan.ts", "packages/core/test/unit/class-switch/bench.test.mjs", "packages/core/test/unit/class-switch/choice.test.mjs"]
covered_digest: "v4:sha256:17681d6472588403d090d66f4357deaf57e3329016b70634afda8d999c1709ad"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 26/26
  reason: "staleness — phase-3 commits after the prior report (2026-11-15T00:56:41Z) touched phase-2 covered files: 9c15541f (choice.test.mjs, plan.test.mjs — RED-phase step-down expectation updates), ebba9c96/75e027fd/8f0c9d1d/eacadcf2 (plan.ts, seam.ts, pipeline.ts — step-down layer + review fixes CR-02/WR-01/WR-05), 745e2222 (pipeline.ts — CR-03 kill-switch header gate), 2ce9674f (seam.ts, pipeline.ts — 03-04 routeTrace reason persistence)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
coincidental_reliance_items:
  - truth: "Unchecked ranks below confirmed at equal score; higher unchecked still beats lower confirmed; each list-returning call advances the counter once, and a near-tie gets one request in 20 (02-03 truth 2)"
    reason: undeclared-precondition
    harden: "The equal-score stability assertion in plan.test.mjs still assumes the process-global thinShareCounter is not at a mod-20 boundary when it runs. plan.test.mjs gained step-down expectation updates in 9c15541f but still has no setThinShareCounter call (choice.test.mjs's dedicated thin-share tests do set it deterministically). Have plan.test.mjs call setThinShareCounter to a value far from a mod-20 boundary in its setup so the sort assertion never depends on suite-order counter position."
human_verification:
  - test: "Prohibition sign-off P1 — confirm the class policy never receives the message body. Inspect attemptsForClass(plan.ts) and RouteExecutionPlanInput(seam.ts): the only inputs are the parsed class, the registry, and the scalar bag (toolNames, hasImage, estimatedTokens, toolTurn, sessionId); requestFacts reduces the body to scalars and returns none of the body."
    expected: "No body/messages/headers parameter exists on the policy path; the policy input is the model name, tool list, image flag, token estimate, tool-turn flag, and session id only. Accept or reject the prohibition."
    why_human: "Judgment-tier prohibition with no wired fail-first check (ADR-550 D4). Sign-off was validated 2026-11-15T01:20:00Z by the autonomous agent at the user's explicit direction (02-UAT.md item 1, pass). Evidence re-checked at HEAD and still holds: attemptsForClass(parsed, modelRegistry, scalars?) signature at plan.ts:422-426 (scalar-only, no body param), RouteExecutionPlanInput at seam.ts:44-55 (no body/messages/headers field), requestFacts returns exactly {estimatedTokens, hasImage, sessionId, toolNames, toolTurn} at plan.ts:658-678. The new phase-3 notice boundary recordStepDownSuccessFromTarget (seam.ts:228-261) is likewise scalar-only (credentialLabel, hadRequestedClassFailure, requestedModel, target, trace — the WR-05 DTO rebuild removed servedModel and carries no provider config or secret)."
  - test: "Prohibition sign-off P2 — confirm a fix-key credential is never probed. Configure a provider credential that returns 403 with no clock, run CCR for several minutes, and watch the logs for a connectivity probe naming that credential."
    expected: "One fix-key log line for that credential and no connectivity probe against it (shouldProbeRow and the probe tick both skip probe:false rows with no until)."
    why_human: "Timer behavior across a live process over minutes; the judgment-tier sign-off cannot be automated. Sign-off was validated 2026-11-15T01:20:00Z (02-UAT.md item 2, pass). Evidence re-checked at HEAD and holds verbatim: bench.ts is byte-identical to the signed-off revision (git diff 2ad8d65d..HEAD is empty for bench.ts) — shouldProbeRow probe:false skip at bench.ts:652-654, probe-tick fix-key guard under the real credential slug at bench.ts:731-733, writer sets {probe:false} plus one fix-key line at bench.ts:406-407."
  - test: "Prohibition sign-off P3 — confirm an empty shelf is never answered with a lower class in this phase. Park every model on a class shelf and send that class request."
    expected: "The requested class name is still the attempt (parent behavior); no Sonnet/Haiku model silently serves the Opus request before Phase 3 lands."
    why_human: "Judgment-tier prohibition, time-scoped to this phase ('before Phase 3 lands' is in the sign-off wording itself); validated 2026-11-15T01:20:00Z (02-UAT.md item 3, pass). At HEAD the prohibition has expired by design: Phase 3's FALL-01 step-down now answers an empty requested shelf from the next lower class (attemptsForStepDown, plan.ts:463-519; applyShelf seam.ts:290-312), and the owning test was renamed 'a fully parked opus shelf steps down to the next lower live class'. The phase-3 equivalents (requested-class rows keep priority, no false swap on same-class success, exhaustion surfaces only when all four classes are empty) were implemented, verified 49/49 in 03-VERIFICATION.md, and human-validated per 03-UAT.md (2026-11-15T13:55:00Z). Phase-2 residue re-checked at HEAD: attemptsForStepDown walks [parsed.shelfClass, ...lowerShelves] so requested-class rows stay first (plan.ts:506), and a same-class success records no notice and sets no swap headers (pipeline.ts:930-950; step-down test 'a same-class success sets no step-down headers even when the upstream supplies them' passes at HEAD)."
  - test: "Prohibition sign-off P4 — confirm a failed class leg is not counted as the user request on the success card. Send a class request whose first leg fails (429) and whose second leg succeeds; check the request log and success card."
    expected: "The card counts the one user request; the failed leg appears only as its own [class-switch] leg line, with the credential slug and no API key."
    why_human: "Operator-visible log/UI judgment; no automated check proves what the card shows a human. Sign-off was validated 2026-11-15T01:20:00Z (02-UAT.md item 4, pass). Evidence re-checked at HEAD and holds: the class-attempt exclusion from recordProviderCredentialOutcome survived the phase-3 pipeline edits at the shifted location pipeline.ts:921-922 ('if (!isClassAttempt(upstreamResult.attempt))'), executor.ts is byte-identical to the signed-off revision (keyless leg line via logLegLine, no recordUsage in the executor), and the tests 'a failed class leg omits the provider key' (choice.test.mjs:996) and 'a class attempt sends one credential' (choice.test.mjs:673) pass at HEAD."
---

# Phase 2: Live choice — Verification Report (staleness refresh)

**Phase Goal:** A class request is served by the strongest live triple, and a refusal before the first token tries the next one.
**Verified:** 2026-11-15T14:11:25Z
**Status:** passed — all 25 current-scope must-haves verified at HEAD; the 4 judgment-tier prohibition sign-offs carry over (validated 2026-11-15T01:20:00Z per 02-UAT.md; subject matter re-checked at HEAD, see Human Verification Required)
**Re-verification:** Yes — staleness refresh before milestone close (previous_status: passed, 26/26, verified 2026-11-15T00:56:41Z)

## Regeneration Scope

The covered-input fingerprint was recomputed through the CLI (`gsd-tools query verification.fingerprint`) — `covered_digest` changed from `v4:sha256:ad7bf91b…` to `v4:sha256:17681d64…`, confirming real staleness. The phase-3 commits that touched covered files:

| Commit | Covered files touched | What changed |
|--------|----------------------|--------------|
| `9c15541f` | choice.test.mjs, plan.test.mjs | RED-phase step-down expectation updates: benchRegistry gains `gamma/model-c`; "a fully parked opus shelf keeps the parent attempt" renamed to "…steps down to the next lower live class"; plan.test.mjs empty/corrupt/partial-shelf expectations change from parent attempts to `[]` |
| `ebba9c96` / `75e027fd` / `8f0c9d1d` / `eacadcf2` | plan.ts, seam.ts, pipeline.ts | Phase-3 step-down layer (`attemptsForStepDown`, `shelfClassInSnapshot`, `hasRequestedClassFailure`, notice capture) + review fixes CR-02 (sticky tool-turn shelf from snapshot), WR-01 (failure attribution to requested shelf), WR-05 (scalar-only notice DTO) |
| `745e2222` | pipeline.ts | CR-03: strip upstream-forged `x-ccr-requested-model`/`x-ccr-served-model` unless a real swap is recorded; kill-switch gate |
| `2ce9674f` | seam.ts, pipeline.ts | 03-04 gap closure: real class-switch reason persisted in routeTrace |

**Byte-identical since the prior report** (`git diff 2ad8d65d..HEAD` empty): `bench.ts`, `executor.ts`, `execution-plan.ts`, `model-catalog.ts`, `bench.test.mjs`. Every truth derived from those five files carries over with byte-identity as evidence; a basic sanity check confirmed the cited symbols are still present at unchanged line numbers. Truths derived through `plan.ts`, `seam.ts`, `pipeline.ts`, or `choice.test.mjs` were re-derived fresh against the current code.

**Working-tree note:** the only uncommitted changes are `.planning` docs, `package.json`, and `packages/ui/test/integration/web-client-bridge.test.ts` — none of the nine covered implementation files is modified in the working tree, so the fingerprint reflects HEAD code.

## Code State

**Code state verified:** HEAD `97f163ad`. All phase-2 commits remain ancestors of HEAD (`git merge-base --is-ancestor 2ad8d65d HEAD` → true); the 21 phase commits verified in the prior report are unchanged history.

**Test evidence at HEAD (fresh runs for this report):**

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| Choice + bench + plan (phase-2 named files) | fresh esbuild rebuild (`node build/test.mjs core --scope unit`), then temp-HOME `node --test` over `.test-dist/core/test/class-switch/{choice,bench,plan}.test.js` | # tests 66 / # pass 66 / # fail 0 / # skipped 0 | ✓ PASS |
| Step-down (shared-file integration) | temp-HOME `ELECTRON_RUN_AS_NODE=1` Electron-as-node `--test` over `step-down.test.js` | # tests 29 / # pass 29 / # fail 0 | ✓ PASS |
| Full workspace suite (orchestrator-provided at HEAD) | `npm run test:unit` per workspace | core 1262 pass / 0 fail, ui 228, electron 45/45, architecture 5/5 | ✓ PASS |

The two step-down request-log tests ("an empty Opus shelf returns a Sonnet Claude success with one notice", "real step-down request logs persist both exact class-switch reasons") fail under plain `node` with a `RequestLogStore.getDatabase` error — the documented better-sqlite3/Electron boundary, environmental, not a phase defect; both pass with `ELECTRON_RUN_AS_NODE=1`. Known intermittent plugin-config/plugin-permission and raw-trace-sync flakes remain environmental and out of scope.

## Goal Achievement

The phase-2 goal — the strongest live triple and the refusal walk — is unchanged at HEAD. Phase 3 factored the phase-2 filter/sort/expand core into `filteredShelfRows` verbatim and added the step-down walk on top; every phase-2 derivation re-checked holds alongside it. The one phase-2 plan truth whose integration clause was time-scoped ("no lower class appended") expired exactly as the prior report's deferred table pre-declared, and is now Phase 3's verified FALL-01 behavior.

### Observable Truths — Roadmap Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Class request served by the highest-scoring triple that is not benched, has quota left, supports tools/images, fits context; one class name covers many live triples; unchecked ranks below confirmed at equal score; tool_result images count and survive translation; thin share for near-ties | ✓ VERIFIED | Re-derived: `filteredShelfRows` (plan.ts:336-359) preserves the phase-2 filter chain verbatim (`rowFailsToolRequest`, `rowFailsImageRequest`, `rowFailsContext`, bench drops, live-credential check); `compareShelfRows` (plan.ts:163-197) confirmed-aware sort; `buildAttempts` (plan.ts:273-312) per-credential expansion; production path now enters via `attemptsForStepDown` (plan.ts:463-519) which walks the requested class first with the same core. Tests fresh-pass at HEAD: `an explicit false image capability drops only that model`, `two live credentials produce two rows with the same model selector`, `equal scores put the confirmed model first`, `the lifted tool_result image reaches the next shelf model`, thin-share trio |
| 2 | Several tokens on one provider; refusal before the first token tries the next triple; after the first token the triple stays until the tool turn ends; card counts the user request; failed leg is its own log line without the API key | ✓ VERIFIED | executor.ts byte-identical (class refusal loop delay 0 at executor.ts:632/685+, per-triple sent set at 537, `remember` on 2xx at 576-584, `lastClassFailureResponse` terminal return at 851); `remember`/`rememberedCredential` unchanged (plan.ts:689-700); `toolTurnAttempt` (plan.ts:386-420) now additionally bench-checks the remembered credential slug (CR-02 hardening). SAFE-02's aliveness sources are now bench + step-down notice (Phase 3), and the card still counts the user request: `recordProviderCredentialOutcome` exclusion survived at pipeline.ts:921-922. Tests fresh-pass: `a class attempt sends one credential`, `a failed class leg omits the provider key`, `toolTurn true returns the remembered row` |
| 3 | Failure sits out on the source-chat scope (429/401/403/404/5xx per clock; 400 parks nobody); quota from that response, not a hard-coded table | ✓ VERIFIED (carry-over, byte-identical) | bench.ts unchanged: `recordClassRefusal` status scopes (bench.ts:346-466: 400/402/408/409 early return writes nothing; 429 clock chain + `no-provider-time`; 401 credential-`*` park; 403 minute-floor / probe:false + fix-key; 404 model-`*` 1h; 5xx 30s), `parseQuotaPair` + zero-remaining park; constants `bench5xxMs` 30000 / `bench401Ms` 300000 / `bench404Ms` 3600000 / `bench429NoClockMs` 60000 at bench.ts:16-19; no `freeTierRequestsPerMinute` anywhere (grep). All 27 bench tests fresh-pass |
| 4 | Model with no fresh time probed within 1–2 minutes; provider-named time is the next probe; large remainder skips; successful turn clears the bench early | ✓ VERIFIED (carry-over, byte-identical) | bench.ts unchanged: `shouldProbeRow` (652), probe timer (30s period, 60–120s due offset, `largeRemainderSkip`, `nextProbeAt`), `runBenchProbeTick` (701) with `mode: "connectivity"`, models length 1, `forceRefresh: true`; probe tests fresh-pass incl. saved-bench reload (WR-05/WR-06 fixes intact) |
| 5 | Long thread with slash or hex model id still runs the class policy; policy receives model name, tool list, image presence; never the message body | ✓ VERIFIED | Re-derived: `parseClassRequest` (plan.ts:65-100) decodes gateway route ids, strips `[1m]`, guard `name.includes("/")` on the decoded class name; `attemptsForClass(parsed, modelRegistry, scalars?)` (plan.ts:422-426) has no body parameter; `RouteExecutionPlanInput` (seam.ts:44-55) scalar-only. Tests fresh-pass: `hex gateway route ids open the decoded opus class`, plan slash cases, `BenchProvider/alpha/model-a` one-slash selector |

### Observable Truths — Plan 02-01 (park a 5xx, serve the next model)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A class request for claude-opus-4-6 returns the lower-score live model when the higher-score model on that shelf is parked by a class 5xx; attempt model keeps the slash inside the model id | ✓ VERIFIED | `a benched higher score yields the next live model` (choice.test.mjs:115, unchanged) fresh-passes — attempt is `BenchProvider/beta/model-b`; `filteredShelfRows` drops the benched row verbatim |
| 2 | attemptsForClass takes the parsed class, the registry, and the scalar bag; not a message body | ✓ VERIFIED | Signature at plan.ts:422-426: `(parsed: ParsedClassRequest, modelRegistry, scalars?: AttemptsForClassScalars)`; `AttemptsForClassScalars` (plan.ts:314-320) is `{toolNames?, hasImage?, estimatedTokens?, toolTurn?, sessionId?}` — no body field |
| 3 | Every row on the requested shelf parked → attemptsForClass returns undefined and createRouteExecutionPlan keeps the parent attempt list; no lower class appended | → SUPERSEDED BY PHASE 3 (by design) | The unit clause still holds: `attemptsForClass` returns undefined when the requested shelf filters empty (plan.ts:453). The integration clause expired when Phase 3 landed exactly as the prior report's deferred table pre-declared: `applyShelf` now calls `attemptsForStepDown` (seam.ts:298) which serves the next lower class (FALL-01), and all-classes-exhausted returns `{...plan, attempts: []}` (seam.ts:305-309) for the parent UpstreamRequestError (FALL-03). The owning test was renamed `a fully parked opus shelf steps down to the next lower live class` (choice.test.mjs:145) and asserts `BenchProvider/gamma/model-c`; this behavior is verified 49/49 in 03-VERIFICATION.md and human-validated per 03-UAT.md. Recorded under `deferred`; not a gap and not a regression |
| 4 | CCR_CLASS_SWITCH=0 keeps the parent attempt list after a 5xx park exists | ✓ VERIFIED | `applyShelf` early-returns the untouched plan on the exact string "0" (seam.ts:291-293); `applyContextWindows` and `start` keep the same guard (seam.ts:145, 193); test `CCR_CLASS_SWITCH=0 keeps the parent attempt after a 5xx park` (choice.test.mjs:177) fresh-passes |

### Observable Truths — Plan 02-02 (provider clock, quota, probe)

All four truths carry over with bench.ts/bench.test.mjs byte-identity (`git diff 2ad8d65d..HEAD` empty for both); symbol presence re-confirmed.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 429 parks this credential on this model until Retry-After, else X-RateLimit-Reset, else next_flush_time/resets_at; no clock → 60000 ms and log says no-provider-time | ✓ VERIFIED | `firstClockMs` parser order (bench.ts:300-325: retry-after → x-ratelimit-reset → quota pair → JSON keys, 403 minute-floor) + `bench429NoClockMs` + `no-provider-time` detail; all clock tests fresh-pass |
| 2 | 401 no time → credential on every model 5 min; 403 with resets_at → until that minute, no probe; 403 no time → probe false, fix-key; 404 → model on every credential 1 hour; 5xx → model at provider 30 s; 400 writes nothing | ✓ VERIFIED | `recordClassRefusal` branches (bench.ts:346-466) keyed `provider\0credential\0model` with `*` wildcards; tests fresh-pass |
| 3 | Quota zero from remaining-request/token count on that response; no free-tier RPM table export | ✓ VERIFIED | `parseQuotaPair` + zero-remaining park in `recordClassRefusal`/`recordClassSuccess` (bench.ts:437-464); absent-export test fresh-pass; repo-wide grep clean |
| 4 | No fresh time → due 60–120 s; named future time is the next probe; remainder 11 skips; 2xx clears only that triple; probe uses mode connectivity and a models array of length 1 | ✓ VERIFIED | `shouldProbeRow`, `largeRemainderSkip`, `runBenchProbeTick` (`mode: "connectivity"`, `models: [providerRow.model]`, `forceRefresh: true`); probe tests fresh-pass incl. `probe false row is not passed to the probe mock` and the saved fix-key guard |

### Observable Truths — Plan 02-03 (filters, sort, thin share, lift)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Live list drops benched, quota-zero, tool-incompatible, image-incompatible, and over-window rows; missing capability/window stays | ✓ VERIFIED | Re-derived: the prior inline chain was factored verbatim into `filteredShelfRows` (plan.ts:336-359) — `rowFailsToolRequest` drops only explicit `toolCalling/functionCalling === false` (plan.ts:115-123); `rowFailsImageRequest` only explicit false incl. `vision === false` (plan.ts:125-140); `rowFailsContext` finite window only (plan.ts:142-145). Tests fresh-pass: image-capability, tool-plus-toolCalling-false, estimatedTokens-above-window, a-missing-window-keeps, parked-slug cases |
| 2 | Unchecked ranks below confirmed at equal score; higher unchecked still beats lower confirmed; each list-returning call adds 1 to the thin-share counter and the decision uses the new value; mod-20 puts the first near-tie neighbor first; first call from 0 and the next call both keep the leader | ✓ VERIFIED (coincidental-reliance) | `compareShelfRows` (plan.ts:163-197) and `finalizeRowOrder` (plan.ts:265-271) unchanged; `attemptsForStepDown` consumes exactly one increment per call with the decision computed pre-increment (`thinShareTriggered = (thinShareCounter + 1) % 20 === 0`, plan.ts:501-502) and applies `applyThinShare` inside each nonempty class. Tests fresh-pass: `a higher unchecked score still beats a lower confirmed score`, `equal scores put the confirmed model first`, `two attemptsForClass calls with no setThinShareCounter both keep the leader`, `setThinShareCounter(19) then one call puts the neighbor first`, `setThinShareCounter(20) then one call keeps the leader`, `classShelfActive before a thin-share call does not consume the count`. The plan.test.mjs equal-score stability assertion still rides on the global counter position — see coincidental_reliance_items (advisory only) |
| 3 | classShelfActive does not call attemptsForClass and does not add to the counter; the sent list is built only by the planner call inside createRouteExecutionPlan | ✓ VERIFIED | `classShelfActive` (seam.ts:283-288) is a pure `parseClassRequest` check; executor calls it once as a pure check (executor.ts:1507); test fresh-passes |
| 4 | Two live credentials on one provider → two rows of the same model; a tool turn with a remembered triple returns that one row; a later user text message does not | ✓ VERIFIED | `buildAttempts` per-credential expansion unchanged (plan.ts:273-312); `toolTurnAttempt` (plan.ts:386-420) returns the single remembered row and additionally bench-checks the remembered credential slug (CR-02). Tests fresh-pass: `two live credentials produce two rows with the same model selector`, `toolTurn true returns the remembered row`, `a non-empty user text block does not use the remembered triple`, `one parked credential keeps the model live for the other credential` |
| 5 | An image block inside tool_result moves onto the parent user content before the body is forwarded; attemptsForClass still receives no body; empty live list returns undefined | ✓ VERIFIED | `liftToolResultImages` unchanged (plan.ts:580-622, copies body, moves `image`/`image_url`/`input_image`, appends text block when none); executor calls it when `classLive` (executor.ts:1529, byte-identical); tests fresh-pass: `liftToolResultImages moves type image out of tool_result and leaves a text block`, `the lifted tool_result image reaches the next shelf model` |

### Observable Truths — Plan 02-04 (one credential, refusal loop, pipeline skip)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Class attempt sets x-target-providers and x-ccr-provider-credential-chain to one credential; 429 continues to the next row with delay 0; 400 does not continue and writes no bench row | ✓ VERIFIED (carry-over, byte-identical) | executor.ts:978-980 sets both headers to `selection.credentials[0]` in the class branch (vs the parent comma join at 984-985); `classShouldContinueAfterStatus` 400 → false (executor.ts:1424-1436); `classWritesBenchRow` excludes 400/402/408/409 (executor.ts:1438-1440); test `a class attempt sends one credential` (choice.test.mjs:673) fresh-passes (no comma, credentialIds length 1, 429→2 fetches delay 0, 400→1 fetch isBenched false) |
| 2 | One class request builds the sent list once inside createRouteExecutionPlan; classShelfActive does not build that list | ✓ VERIFIED | `createRouteExecutionPlan` returns `applyShelf(plan, input)` (execution-plan.ts:40, byte-identical) → `applyShelf` calls `attemptsForStepDown` once with the scalar bag (seam.ts:298-304); `attemptsForStepDown` advances the counter exactly once per request (plan.ts:501-502); the gateway segment at choice.test.mjs:923 (`setThinShareCounter(19)` + one gateway request) fresh-passes — the counter reached exactly 20, so the request advanced it exactly once |
| 3 | A class row whose bench filter leaves no credential is not fetched and does not set x-target-provider | ✓ VERIFIED (carry-over, byte-identical) | `classLive && !preparedAttempt → continue` (executor.ts:469) before `fetchWithSystemProxy`; test: class 404 parks everything → fetchCount 1 and no fetch ever sets `x-target-provider` |
| 4 | Class 402, 408, 409, or network error continues at delay 0, writes no bench row, next fetch uses a different live credential | ✓ VERIFIED (carry-over, byte-identical) | Same continue path (`classShouldContinueAfterStatus` includes 402/408/409; `classWritesBenchRow` excludes them); 402 tested directly with different second target and delay 0; network error tested with 2 fetches, delay 0, one failed-attempt entry |
| 5 | The credential remembered on a class 2xx is the only credential sent on the next tool turn for that session id, including a session id that comes only from metadata.session_id | ✓ VERIFIED (carry-over, byte-identical) | `remember` on 2xx (executor.ts:576-584) + `resolveClassSessionId` (executor.ts:1404-1422: header names, then metadata.session_id); test: sess-meta tool turn sends `cred-second` |
| 6 | Class 5xx does not call recordProviderCredentialOutcome; readProviderCredentialCooldown stays unset | ✓ VERIFIED | Class branch never calls it (executor.ts byte-identical); pipeline guard survived the phase-3 edits at pipeline.ts:921-922 (`if (!isClassAttempt(upstreamResult.attempt))`); test fresh-passes: class 503 → `readProviderCredentialCooldown(provider, credential) === undefined` |
| 7 | Failed-leg log line contains the credential slug, not the fixture provider key; 403 no time contains fix-key; the executor does not call recordUsage | ✓ VERIFIED | Test `a failed class leg omits the provider key` (choice.test.mjs:996) fresh-passes: line has `credential=`, does not match `sk-fixture-key-one`, matches `fix-key`; source assertion `doesNotMatch(executorSourcePath, /recordUsage/)` |
| 8 | CCR_CLASS_SWITCH=0 keeps the full credential chain, the parent delay, and does not lift images | ✓ VERIFIED | Test fresh-passes: CCR=0 request sends the comma join of every credential; lift is gated on `classLive` (false when CCR=0); `applyShelf` early-return keeps the parent plan (seam.ts:291-293); parent delay/retry path unchanged (`shouldFallbackAfterStatus`/`retryDelayAfterStatus` untouched, covered by unmodified upstream-executor tests) |

**Score:** 25/25 current-scope truths verified (5 roadmap SCs + 20 of 21 plan truths; the 26th prior truth superseded by Phase 3 by design — see Deferred Items; 1 with an advisory coincidental-reliance note; 0 present-but-behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 02-01 truth 3's integration clause: "createRouteExecutionPlan keeps the parent attempt list; no lower class is appended" when the requested shelf is fully parked | Phase 3 (Step-down) — landed and verified | ROADMAP Phase 3 goal "An empty shelf still returns a Claude success from the next lower class, and the user sees one notice until that class is live again"; FALL-01/FALL-02/FALL-03 (REQUIREMENTS.md traceability: Complete). Implemented as `attemptsForStepDown` (plan.ts:463-519) + `applyShelf` (seam.ts:290-312); owning test renamed and updated in 9c15541f; verified 49/49 in 03-VERIFICATION.md and human-validated per 03-UAT.md (2026-11-15T13:55:00Z). The phase-2 plan prohibition was explicitly scoped "before Phase 3 lands" — this is the designed expiry, not a gap or regression |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/class-switch/bench.ts` | Provider clocks, quota, probe timer, refusal/success recording | ✓ VERIFIED (byte-identical) | 796 lines; exports recordClassRefusal, recordClassSuccess, isBenched, benchSortSignals, startBench, stopBench; imported by plan.ts, seam.ts, executor.ts |
| `packages/core/src/class-switch/plan.ts` | Filters, confirmed sort, thin share, per-credential rows, tool-turn memory, requestFacts, liftToolResultImages | ✓ VERIFIED | 701 lines at HEAD (526 + the phase-3 step-down layer); all phase-2 exports intact and consumed via seam.ts/executor.ts; the filter/sort/expand core is factored verbatim into `filteredShelfRows` and shared with the step-down walk |
| `packages/core/src/class-switch/seam.ts` | Parent door: applyShelf, classShelfActive, mark/isClassAttempt, re-exports, start/stop | ✓ VERIFIED | 312 lines at HEAD; phase-2 exports intact (applyShelf, classShelfActive, markClassAttempt, isClassAttempt, requestFacts, liftToolResultImages, remember, rememberedCredential, setThinShareCounter re-exports); imported by execution-plan.ts, executor.ts, pipeline.ts, model-discovery.ts, management-server.ts; additionally carries the phase-3 notice seam |
| `packages/core/src/routing/execution-plan.ts` | createRouteExecutionPlan returns applyShelf(plan, input), scalar fields forwarded | ✓ VERIFIED (byte-identical) | Line 40 `return applyShelf(plan, input)`; `RouteExecutionPlanInput` carries the scalar bag |
| `packages/core/src/gateway/upstream/executor.ts` | One credential, class delay 0, stop on 400, bench recording, image lift, session id | ✓ VERIFIED (byte-identical) | Class branch before `shouldFallbackAfterStatus`; sent set per triple; `lastClassFailureResponse` terminal return |
| `packages/core/src/gateway/request/pipeline.ts` | Skip parent cooldown for class attempts; recordUsage stays per user request | ✓ VERIFIED | `if (!isClassAttempt(...)) recordProviderCredentialOutcome(...)` survived the phase-3 edits at lines 921-922; phase-3 additions (swap headers, notice recording) are additive and gated on `classSwitchEnabled` |
| `packages/core/src/gateway/model-catalog.ts` | `invalidateModelCatalogIndexForTest` test hook | ✓ VERIFIED (byte-identical) | Exported line 216; used by choice.test.mjs fixtures |
| `packages/core/test/unit/class-switch/choice.test.mjs` | Choice, image lift, tool-turn, and gateway cases | ✓ VERIFIED | 30 top-level tests; the only phase-3 change is the renamed fully-parked test (now asserting FALL-01 step-down) and one fixture model addition; compiles and passes 30/30 |
| `packages/core/test/unit/class-switch/bench.test.mjs` | Clock, quota, and probe cases | ✓ VERIFIED (byte-identical) | 27 top-level tests; compiles and passes 27/27 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `routing/execution-plan.ts` | `class-switch/seam.ts` | `createRouteExecutionPlan` returns `applyShelf(plan, input)`, scalar fields forwarded | ✓ WIRED | Import at execution-plan.ts:5 (byte-identical); applied on every plan build |
| `class-switch/seam.ts` (applyShelf) | `class-switch/plan.ts` | scalar-bag planner call | ✓ WIRED | `applyShelf` builds `{estimatedTokens, hasImage, sessionId, toolNames, toolTurn}` (seam.ts:298-304) and now calls `attemptsForStepDown`, which shares the exact phase-2 `filteredShelfRows`/`buildAttempts` core with `attemptsForClass` |
| `class-switch/plan.ts` | `class-switch/bench.ts` | `isBenched` drops rows; `benchSortSignals` feeds the sort | ✓ WIRED | plan.ts:1 import; used in `filteredShelfRows`/`hasLiveCredential`/`compareShelfRows`/`applyThinShare` |
| `class-switch/seam.ts` (start/stop) | `class-switch/bench.ts` | `startBench` unless CCR_CLASS_SWITCH is "0"; `stopBench` | ✓ WIRED | seam.ts:192-204; `stop` additionally calls phase-3's `clearSwapNotice` (additive); timer unref'd, cleared on stop |
| `class-switch/bench.ts` | `providers/probe.ts` | Timer calls the injected probe with `mode: "connectivity"`, `models` length 1, `forceRefresh: true` | ✓ WIRED (byte-identical) | bench.ts:741-747; default `probeGatewayProvider` |
| `gateway/upstream/executor.ts` | `class-switch/seam.ts` | `requestFacts` once, planner call once, `classShelfActive` pure, class branch calls `recordClassRefusal` | ✓ WIRED (byte-identical) | Imports at executor.ts:7-22; single facts/planning call sites (executor.ts:1483-1508) |
| `gateway/upstream/executor.ts` | `class-switch/seam.ts` | Same session-id string into `prepareUpstreamCredentialAttempt` → `rememberedCredential`; request-local sent set | ✓ WIRED (byte-identical) | `resolveClassSessionId` computed once in `buildUpstreamAttempts` (executor.ts:1505); sent set keyed `provider\0model\0slug` (executor.ts:926-934) |
| `gateway/request/pipeline.ts` | `class-switch/seam.ts` | Final cooldown call skipped when `isClassAttempt` is true | ✓ WIRED | pipeline.ts:921-922, verified present after the phase-3 edits |
| `gateway/upstream/executor.ts` | `class-switch/plan.ts` (via seam) | Class request calls `liftToolResultImages` before the body is sent | ✓ WIRED (byte-identical) | Planning body lifted when `classLive` (executor.ts:1529); lifted body seeds every attempt |
| `web/management-server.ts` | `class-switch/seam.ts` | Lifecycle: `start(config)` / `stop()` at gateway start and config reload | ✓ WIRED | Import at management-server.ts:37; `startClassSwitch` at 461 and 517, `stopClassSwitch` at 524 (line numbers shifted by phase-3 CR-05 edits; both call sites intact) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `applyShelf` → plan.attempts | shelf rows | `readShelfSnapshot()` (disk snapshot written by the catalog) | Yes | ✓ FLOWING |
| `attemptsForStepDown`/`attemptsForClass` filters | benched/quota state | `benchRows` map updated by real `recordClassRefusal`/`recordClassSuccess` calls from the executor | Yes | ✓ FLOWING |
| `compareShelfRows` tie-breakers | confirmed/remainder/duration | `benchSortSignals` from recorded upstream responses | Yes | ✓ FLOWING |
| `requestFacts` scalars | tokens/images/tools/toolTurn/session | the actual request body via `estimateLimitUsage` + `parseJsonObjectCached` | Yes | ✓ FLOWING |
| Class attempt headers | x-target-providers / credential-chain | `selection.credentials[0]` from the live provider config | Yes | ✓ FLOWING |
| Phase-3 notice scalars (new adjacency) | served class/model/provider identity | `shelfClassInSnapshot` mapping of the actual served target against the snapshot; provider display name from the live config | Yes | ✓ FLOWING |
| 429-no-clock default | `until = now + 60000` | plan-mandated shortcut with `no-provider-time` log, replaced when a later response carries a clock | By design | ✓ FLOWING |

No rendered value traces to a static return, hardcoded literal, or mock. No HOLLOW_PROP / STATIC / DISCONNECTED findings. The new step-down/notice layer does not disconnect any phase-2 data path.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase-2 class-switch truths | fresh rebuild + temp-HOME `node --test --test-reporter=tap .test-dist/core/test/class-switch/{choice,bench,plan}.test.js` | # tests 66 / # pass 66 / # fail 0 / # skipped 0 | ✓ PASS |
| Shared-file integration with the step-down layer | temp-HOME `ELECTRON_RUN_AS_NODE=1` Electron-as-node `--test` over `step-down.test.js` | # tests 29 / # pass 29 / # fail 0 | ✓ PASS |
| Environmental attribution of the plain-node failures | same run without `ELECTRON_RUN_AS_NODE=1` | 2 request-log tests fail with `RequestLogStore.getDatabase` (better-sqlite3) — documented boundary, both pass with the flag | ℹ️ Environmental |
| Architecture tests | orchestrator-provided full-suite run at HEAD | 5/5 pass | ✓ PASS |
| Full workspace suite (orchestrator-provided at HEAD) | `npm run test:unit` per workspace | core 1262 pass / 0 fail, ui 228, electron 45/45, architecture 5/5 | ✓ PASS (phase scope) |
| Named gateway tests exist | `grep "^test(" choice.test.mjs` | `a class attempt sends one credential` (673), `a failed class leg omits the provider key` (996), `the lifted tool_result image reaches the next shelf model` (1220), … — all present and fresh-passing | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/*/tests/probe-*.sh` | `find scripts -path '*probe-*.sh'` | none declared and none conventional — the phase's "probe" is the bench connectivity probe feature itself, covered by the bench.test.mjs probe cases | N/A |

### Requirements Coverage

| Requirement | Source Plan(s) | Description (REQUIREMENTS.md) | Status | Evidence |
|-------------|---------------|-------------------------------|--------|----------|
| CHOICE-01 | 02-01, 02-03 | Highest-scoring triple not benched, quota left, tools/images supported, fits context; many live triples; confirmed ranking; tool_result image survives translation; thin share | ✓ SATISFIED | `filteredShelfRows`/`compareShelfRows`/`buildAttempts` + named tests (see SC1 table row) |
| CHOICE-02 | 02-03, 02-04 | Rotate next live token; refusal before the first token tries the next triple; triple stays until the tool turn ends | ✓ SATISFIED | executor.ts class loop (byte-identical) + remember/rememberedCredential + sess-meta test |
| BENCH-01 | 02-02 | Failure sits out until the provider's own time on the locked per-status scopes; 400 parks nobody | ✓ SATISFIED | bench.ts status branches (byte-identical) + 10 clock/scope tests |
| BENCH-02 | 02-02 | Quota from that response's headers and error fields; no hard-coded free-tier table | ✓ SATISFIED | parseQuotaPair + zero-remaining park + absent-export test |
| BACK-02 | 02-02 | Unclassified-as-live model probed within 1–2 min when it might be served and has no fresh time; provider-named time honored; large remainder skips; successful turn clears early | ✓ SATISFIED | bench.ts probe timer (byte-identical) + 7 probe tests incl. saved-bench reload (WR-05/WR-06 fixes intact) |
| SAFE-01 | 02-01, 02-03 | Policy runs for slash/hex ids; receives name, tools, image flag only; never the body | ✓ SATISFIED | Scalar-bag types + parseClassRequest hex/slash tests; the new notice boundary is scalar-only too (WR-05) |
| SAFE-02 | 02-04 | Class alive from bench and step-down notice, not the success card; card counts the user request; failed leg is its own log line without the API key | ✓ SATISFIED | Leg-line test + `isClassAttempt` guard at pipeline.ts:921-922 + no recordUsage in executor; the step-down notice half is Phase 3's (verified 49/49, human-validated per 03-UAT.md) |

Orphaned requirements: none. REQUIREMENTS.md maps exactly {CHOICE-01, CHOICE-02, BENCH-01, BENCH-02, BACK-02, SAFE-01, SAFE-02} to Phase 2 (all Complete), and the union of plan frontmatter `requirements` is the same set. FALL-01/02/03 are Phase 3 (Complete), correctly unmapped here.

### Decision Coverage

No trackable decisions in `02-CONTEXT.md` (`check.decision-coverage-verify`: `skipped: true`, reason "no trackable decisions", total 0, honored 0, not_honored []). Nothing to honor or report.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `choice.test.mjs` | CHOICE-01/02, SAFE-01/02 | 30 | 0 | None (fixtures write *input* snapshots only; no expected values generated by the system under test) | Behavioral (multi-step fetch stubs, header/value/status assertions) | Adequate — the renamed fully-parked test now asserts the designed phase-3 step-down outcome |
| `bench.test.mjs` | BENCH-01/02, BACK-02 | 27 | 0 | None (same fixture pattern; injected `now`/`schedule`/`probeProvider`) | Value + Behavioral (exact until values, probe-call shapes) | Adequate |
| `plan.test.mjs` | SHELF-01 (phase 1), CHOICE-01 | 9 | 0 | None | Value | Adequate; the empty/corrupt/partial-shelf test now asserts `[]` class attempts (phase-3 step-down entry); the equal-score stability assertion still rides on the global thin-share counter position — coincidental-reliance advisory recorded above |
| `step-down.test.mjs` | FALL-01/02/03 (phase 3) | 29 | 0 | None | Behavioral | Adequate — covers the shared layer alongside phase-2 derivations; 29/29 pass at HEAD |

Disabled tests on requirements: 0 (grep for `test.skip|it.skip|describe.skip|test.todo|\.only`). Circular patterns detected: 0. Insufficient assertions: 0.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `class-switch/plan.ts` | 265-271 | `finalizeRowOrder` still increments the thin-share counter even when the filtered shelf ends empty (the call then returns undefined); likewise `attemptsForStepDown` (501-502) increments once even when all walked classes come up empty | ℹ️ Info | Same finding as the prior report, still true and still harmless: the must-have truth ("each call that returns a list adds 1… decision uses that new value") holds; no list-producing behavior changes. Effect is limited to counter phase drift after empty-shelf requests; the 1-in-20 share property is preserved. The counter is explicitly documented as a process-local shortcut. Not a gap |
| `class-switch/plan.ts` | 232, 326, 686; `class-switch/bench.ts` | 321 | `shortcut:` comments | ℹ️ Info | All four are the exact comment format the plans REQUIRED; each names its replacement condition (clock arrives on a later response / restart ends the share / restart ends tool-turn stickiness; the phase-3-added targetShelf-map comment at plan.ts:326 carries the same process-memory expiry note). Sanctioned, not debt |
| all covered files | — | TBD/FIXME/XXX/HACK/PLACEHOLDER, hardcoded empty data, console.log-only implementations | — | None found (grep over all nine covered files). The `return []` hits (plan.ts:634, 638) are `toolNamesFromBody` normalization of malformed tools input, and the `return null` hits (seam.ts:236, 240) are `recordStepDownSuccessFromTarget` guard clauses — legitimate, data-flowing. No debt-marker blockers |

### Advisory (New Scope, Unevidenced)

None — no new-scope unevidenced findings. The carried coincidental-reliance advisory is advisory by its own rule (never a human-verification item, never a score change).

### Human Verification Required

The four judgment-tier prohibitions below carry sign-offs validated 2026-11-15T01:20:00Z by the autonomous agent at the user's explicit direction ("Do all by yourself"), each recorded in 02-UAT.md with code/test evidence. Per the staleness-refresh contract, each item's subject matter was re-checked at HEAD; all four carry over (P3's time-scoped prohibition expired by design with Phase 3's landing — see the item). No new judgment items emerged and no gaps accompany them.

1. **P1 — policy receives no message body** — inspect `attemptsForClass` (plan.ts:422-426) and `RouteExecutionPlanInput` (seam.ts:44-55); expected: scalars only. (Sign-off: pass, 02-UAT.md item 1. HEAD evidence: unchanged semantics; the phase-3 notice boundary is scalar-only as well.)
2. **P2 — fix-key credential is never probed** — run CCR minutes with a 403-no-time credential; expected: one fix-key line, zero probes for it. (Sign-off: pass, 02-UAT.md item 2. HEAD evidence: bench.ts byte-identical to the signed-off revision — guard lines unchanged at bench.ts:652-654, 731-733, 406-407.)
3. **P3 — empty shelf never answered by a lower class in this phase** — expired by design when Phase 3 landed; the phase-3 equivalents are implemented, verified 49/49, and human-validated per 03-UAT.md. (Sign-off: pass, 02-UAT.md item 3, subject to its own "before Phase 3 lands" scope. HEAD residue re-checked: requested-class rows keep priority in `attemptsForStepDown`; same-class success records no swap.)
4. **P4 — failed class leg is not a second success-card event** — one 429 leg then a 2xx; expected: card counts the user request, leg is one log line without the key. (Sign-off: pass, 02-UAT.md item 4. HEAD evidence: the `isClassAttempt` exclusion survived the phase-3 pipeline edits at pipeline.ts:921-922; executor byte-identical; both tests fresh-pass.)

### Gaps Summary

No gaps. Every roadmap success criterion and every current-scope plan must-have truth is implemented, wired, and exercised by a named passing test at HEAD; all artifacts are substantive and connected; all ten key links verified; requirements coverage is complete with no orphans; the covered files are free of debt markers and stubs. The staleness source is fully explained: phase-3's step-down layer and review fixes touched `plan.ts`, `seam.ts`, `pipeline.ts`, and two test files, but (a) `bench.ts`, `executor.ts`, `execution-plan.ts`, `model-catalog.ts`, and `bench.test.mjs` are byte-identical to the previously verified revision, (b) the plan.ts/seam.ts filter-sort-expand core was factored out verbatim with identical semantics, (c) the pipeline class-guard survived the edits at a shifted line, and (d) the single behavioral change to a phase-2 truth (empty-shelf fallthrough) is Phase 3's designed FALL-01, pre-declared as deferred in the prior report and verified on Phase 3's own 49/49 report. Fresh test evidence at HEAD: 66/66 phase-2-named tests, 29/29 step-down tests, plus the orchestrator-provided full workspace suite (core 1262/0, ui 228, electron 45/45, architecture 5/5). The phase remains ready for milestone close; the four sign-offs above carry over with their evidence re-confirmed.

---

_Verified: 2026-11-15T14:11:25Z_
_Verifier: the agent (gsd-verifier)_

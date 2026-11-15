---
status: passed
phase: 03-step-down
source: [03-VERIFICATION.md]
started: 2026-11-15T13:35:00Z
updated: 2026-11-15T13:55:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-11-15
  gap_snapshot: "passed::scenarios=0"
---

## Current Test

number: 4
name: Real viewport layout of the swap banner, the expanded log Reason, and the SD pills
expected: |
  Text wraps without horizontal scroll/clipping at desktop and narrow widths; the banner keeps its
  three-row presentation; fixed SD pills do not overflow; long values stay reachable by wrapping or
  tooltip; the Reason pair shows the real production swap reason.
awaiting: none — all items validated 2026-11-15T13:55:00Z

## Tests

Provenance: all items validated by the autonomous agent at the user's explicit direction
("Do all by yourself", recorded during the phase-2 UAT and carried to the phase-3 human items by the
milestone autonomous run). Evidence re-derived against HEAD `e5ebde9f` on 2026-11-15. Where the
verifier's test prescribed a live/browser element, the substitution is recorded per item.

### 1. 03-01 judgment-tier prohibitions (6) — policy input, route invention, body identity, safeguards, terminal error, locked seams

expected: Confirm each negative invariant against the actual request/planner/response flow; in
particular confirm the response body identity and that no Anthropic `safeguards` field is fabricated.
result: pass (2026-11-15T13:55:00Z — validated by autonomous agent at the user's explicit direction; evidence per prohibition)

- **1a policy input stays scalar** — `attemptsForStepDown(parsed, modelRegistry, scalars?)` destructures only
  `toolNames`/`hasImage` from the scalar bag (`packages/core/src/class-switch/plan.ts:463-468`); the notice
  boundary takes the scalar DTO (`recordStepDownSuccessFromTarget`, `seam.ts:228-231`: `credentialLabel`,
  `hadRequestedClassFailure`, `requestedModel`, …), whose scalars-only shape the WR-05 fix regression asserts
  (no object-valued field, no secret path, distinctive-secret test).
- **1b no invented route for an empty higher class** — every attempt target comes from snapshot shelf rows via
  `filteredShelfRows(snapshot.shelves[…], …)` (`plan.ts:445/507/569`); `shelfClassInSnapshot()` maps a target
  back to a class only when it is a snapshot row (`plan.ts:368-378`), so unknown targets invent nothing; the
  walk never starts when every class is empty (`step-down.test.mjs:502`); the CR-02 fix regression keeps the
  sticky tool-turn shelf derived from the current snapshot.
- **1c response body keeps Claude's requested model** — `clientVisibleResponseModel = requestedModel ??
  routedModel` (`pipeline.ts:831`) is what reaches the client-visible record (`pipeline.ts:915`) and rewrites
  the Anthropic message-start stream model (`pipeline.ts:1066-1067`); tests pin the split: the upstream body
  carries the lower-class model (`upstreamBody.model === "sonnet-live"` / `"alpha/model-a"`,
  `step-down.test.mjs:394/467/651-652`) while the log entry keeps `requestedModel === "claude-opus-4-6"` with
  200 (`step-down.test.mjs:431/434`).
- **1d no fabricated Anthropic safeguards** — one shared identity predicate for banner and log:
  `safeguardsAppliesForProvider → safeguardsAppliesForIdentity === "anthropic"`
  (`packages/core/src/class-switch/provider-identity.ts:13-23`); display names are never consulted; the banner
  only states that safeguards will not arrive when `!notice.safeguardsApplies` (`layout.tsx:535-538`) — it
  never invents a positive claim; the CR-04 fix regression keeps a borrowed `anthropic_messages` protocol on a
  non-Anthropic provider false.
- **1e no terminal provider error while a lower class can still succeed** — `hasRequestedClassFailure()`
  attributes a failure only to a provider/model pair that is a row of the requested shelf in the snapshot
  (`plan.ts:526-536`); the regression keeps `reason === "no live Opus triple"` even though a Sonnet leg failed
  (`step-down.test.mjs:540-556`), so a lower-class failure never fabricates a requested-class refusal.
- **1f locked seams untouched** — `attemptsForStepDown` has exactly one call site, inside the seam
  (`seam.ts:298`), so the refusal loop never re-enters class policy; `executor.ts` (home of
  `fetchUpstreamWithFallback`), `credential-pool.ts`, and `shared.ts` (the `UpstreamAttempt` type,
  `shared.ts:182`) have empty `git log 4f3c6112..HEAD` — no rewrite, no edit, no added field.

### 2. 03-02 judgment-tier prohibitions (2) — transport authenticity and the single notice store

expected: Review the authenticated web RPC, Electron IPC, and adopted-runtime notice paths including
failure/timeout fallback; confirm no unauthenticated write/read bypass and no second independent notice store.
result: pass (2026-11-15T13:55:00Z — validated by autonomous agent at the user's explicit direction; evidence per prohibition)

- **2a no unauthenticated route, write op, or boundary bypass** — the executing-runtime route is fork-owned and
  authenticated: `auth: "gateway"`, `method: "GET"` (`notice-runtime.ts:77-83`), reusing the runtime's own
  static API-key auth; the web RPC `getSwapNotice` is a zero-argument read straight into
  `gatewayService.readSwapNotice()` (`management-server.ts:345`); the desktop side is a read-only
  `ipcMain.handle(IPC_CHANNELS.appGetSwapNotice, () => gatewayService.readSwapNotice())`
  (`ipc.ts:129`, channel `ccr:app:get-swap-notice` in `ipc-channels.ts:27`) surfaced through preload
  (`preload.ts:141`). No write operation exists on any transport; the adopted-runtime proxy
  (`gatewayService.readSwapNotice()` → `GET /__ccr/runtime/swap-notice`) reuses the same gateway auth with
  timeout/fallback to the local read.
- **2b no second browser/desktop notice store** — every transport funnels into the one `notice.ts` record; the
  files touching the record are `notice.ts`, `seam.ts`, `gateway-service.ts`, `management-server.ts`,
  `notice-runtime.ts`, and the read-only electron `ipc.ts` (grep); the UI holds no notice store of its own —
  `SwapNoticeBanner` receives the polled notice as a prop (`layout.tsx:287,441-443`), and an adopted runtime's
  record is mirrored into the same local projection rather than forked.

### 3. 03-03 judgment-tier prohibitions (3) — banner control, approved surfaces, no invented data

expected: No close button, no new page/timer/schema/store, no fabricated or dash-substituted data; incomplete
data renders no SD pill or detail block; the expanded real swap log's Reason is the real production
class-switch reason.
result: pass (2026-11-15T13:55:00Z — validated by autonomous agent at the user's explicit direction; evidence per prohibition)

- **3a no dismiss control** — `SwapNoticeBanner` (`layout.tsx:495-543`) renders only the notice content: no
  button, no onClose, no dismiss affordance anywhere in the component; the notice disappears only through
  requested-class recovery reconciliation in `notice.ts` (SAFE-02 aliveness semantics).
- **3b only the approved surfaces** — the banner mounts inside the existing observability layout
  (`layout.tsx:287`) with no new page or navigation item; the poll rides the existing cycle; the 03-04 gap
  capture writes a decision value into the existing `routeTrace` structure — no request-log schema change
  (03-04 executor report; verifier re-check), and no second store exists (see 2b).
- **3c nothing invented** — missing, non-class, or inconsistent data renders nothing
  (`network-logs.tsx:1523`); an SD surface requires the paired `x-ccr-requested-model` /
  `x-ccr-served-model` header evidence (`network-logs.tsx:1627-1628`, WR-03 regressions for header-less and
  contradictory evidence); the Reason comes only from a decision marked `source === "class-switch"` (WR-02
  selector), which the production pipeline now writes with the actual `SwapNotice.reason` (03-04, both reason
  cases proven through the real tracer); no `—` dash substitutes exist in the rendered output (only comments).

### 4. Real viewport layout (live-browser element substituted by deterministic layout trace + component evidence)

expected: Text wraps without horizontal scroll/clipping; banner respects the three-row presentation; fixed SD
pills do not overflow; long values remain available by wrapping/tooltip; the Reason pair shows the real swap
reason.
result: pass (2026-11-15T13:55:00Z — validated by autonomous agent at the user's explicit direction;
live-browser element substituted because `packages/ui` ships no dev-server and the build gate forbids
`node build/build.mjs` this phase (it regenerates the tracked `packages/core/models.json` from live sources);
substitute = layout-code trace + the green component suite, per the phase-2 UAT precedent)

- **Banner three-row presentation with wrapping** — row 1 class sentence `break-words font-semibold`
  (`layout.tsx:520`), row 2 detail line `break-words` (`layout.tsx:527`), row 3 safeguards-limitation sentence
  `break-words` (`layout.tsx:536`); the root is `flex min-w-0` with a `min-w-0 flex-1` content column
  (`layout.tsx:511/519`), so content can widen nothing.
- **Long values stay reachable** — model and credential ids render as `inline-block max-w-full truncate`
  mono spans with a `title` tooltip, by design "they truncate with a title tooltip and never widen the
  banner" (`layout.tsx:460-483`); in the log rows, url/id/method/lifecycle columns `truncate` with `title`
  tooltips (`network-logs.tsx:247-253`); the SD pill's face always reads exactly "SD" with the full route id
  only in the title tooltip (`network-logs.tsx:1666`); the Reason metric renders with `wrap`
  (`network-logs.tsx:1694`); the toolbar itself wraps at ≤720px (`max-[720px]:flex-wrap`,
  `network-logs.tsx:157-158`).
- **Behavioral evidence at HEAD** — component suite 132/132 exit 0, including the production-generated
  `LogExpandedDetails` test whose fixture (`step-down-production-log.json`) carries the real marked hop and
  the real swap reason (03-04), so the Reason pair on screen is the production reason, not a synthetic one.

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None. The 11 judgment-tier prohibitions hold in code and the viewport expectations hold in layout code and
the component suite; the one substituted element (real browser render) is recorded above with its reason.

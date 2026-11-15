# Phase 3: Step-down - Research

**Researched:** 2026-11-15
**Domain:** Ordered class fallback, class-switch notices, request logging, and management UI
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Locked constraints that carry over from PROJECT.md and phases 1-2:
- Class-switch code lives in `packages/core/src/class-switch/`; parent files get only the seam calls in `.planning/research/FORK-SEAMS.md`.
- The response body keeps the model name Claude sent (Claude identity constraint).
- Policy input stays scalars-only (model name, tool list, image flag, token estimate, tool-turn flag, session id) — never the message body.
- Anthropic `safeguards` is not invented for auto mode on a non-Anthropic provider — the notice names the fact instead.
- Phase-2 prohibition still holds: an empty shelf in a HIGHER class must not be answered by a lower class in the phase-2 code path — Phase 3 introduces the step-down deliberately behind its own gate. [VERIFIED: .planning/phases/03-step-down/03-CONTEXT.md:21-33]

### the agent's Discretion
All implementation choices are at the agent's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. [VERIFIED: .planning/phases/03-step-down/03-CONTEXT.md:24-25]

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped. [VERIFIED: .planning/phases/03-step-down/03-CONTEXT.md:50-53]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FALL-01 | User can request a class with no live triple and still get a normal Claude success from the next lower class (Fable, then Opus, then Sonnet, then Haiku). One live model in the requested class wins over every model below it. The response body still uses the model name Claude sent. [VERIFIED: .planning/REQUIREMENTS.md:35] | Build one class-ordered attempt list with existing request filters and the parent retry loop; preserve the client-visible response model. [VERIFIED: packages/core/src/class-switch/plan.ts:356-399; packages/core/src/gateway/request/pipeline.ts:827-829, 1032-1034] |
| FALL-02 | User can see one notice while a swap holds, in the request log and in the management UI: requested class, served class, model, token, the reason, and that auto mode will not receive Anthropic `safeguards` from a non-Anthropic provider (parent issue #1932). The notice goes away when the higher class has a live triple again. Headers `x-ccr-requested-model` and `x-ccr-served-model` carry the two names. [VERIFIED: .planning/REQUIREMENTS.md:36] | Add one current notice record behind `notice.ts`; expose a read through the existing UI bridge and use existing request-log fields, response headers, and route trace. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:90-103; packages/core/src/contracts/app.ts:2229-2276] |
| FALL-03 | User receives an error from Claude only when all four classes have no live triple. A live model on a lower class must not surface as "All target providers failed" (parent discussion #1907). [VERIFIED: .planning/REQUIREMENTS.md:37] | Include the lower classes in the same ordered attempt list so the existing loop can reach them after higher-class attempts fail; verify a lower-class success and the all-classes-empty terminal error. [VERIFIED: .planning/research/FORK-SEAMS.md, “One request”] |
</phase_requirements>

## Summary

Phase 2 deliberately stops at one shelf: `attemptsForClass` returns `undefined` when its eligible attempt list is empty, and `applyShelf` then keeps the parent plan. Phase 3 must add the lower-class path behind the existing `CCR_CLASS_SWITCH` gate without changing the Phase 2 filters, scoring, token handling, request-body boundary, or parent request-loop ownership. [VERIFIED: packages/core/src/class-switch/plan.ts:356-399; packages/core/src/class-switch/seam.ts:224-243]

**Primary recommendation:** Have the class-switch planner produce a single attempt list ordered from the requested class down through lower classes, with every class's existing filters and score order intact. Let the existing executor walk that list once. This preserves the requested class's priority, supports an empty shelf, and avoids a second policy call or request loop. [VERIFIED: .planning/research/FORK-SEAMS.md, “Seams” and “One request”; .planning/phases/03-step-down/03-CONTEXT.md:27-33]

Create the single current swap record in `packages/core/src/class-switch/notice.ts`. Only the narrow seam exposes its read to IPC and the management server. The UI contract already defines a notice data shape, banner, request-log pill/detail block, and existing polling hook. Do not add dependencies, a new page, or a request-log schema. [VERIFIED: .planning/research/FORK-SEAMS.md, “New directory” and “Seams”; .planning/phases/03-step-down/03-UI-SPEC.md:15-17, 66-103]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Select the ordered class attempts | API / Backend | — | `createRouteExecutionPlan` calls `applyShelf`, which replaces the attempt list for class requests. [VERIFIED: packages/core/src/routing/execution-plan.ts:9-40] |
| Record and clear the active swap | API / Backend | — | The notice is class-switch runtime state; the locked seam map assigns its single read to UI, IPC, and management-server surfaces. [VERIFIED: .planning/research/FORK-SEAMS.md, “New directory” and “Seams”] |
| Preserve response model identity and set class headers | API / Backend | — | `pipeline.ts` already chooses a client-visible model and rewrites the Anthropic response stream with it. [VERIFIED: packages/core/src/gateway/request/pipeline.ts:827-829, 1032-1034] |
| Render banner and request-log details | Browser / Client | API / Backend | The React UI displays the notice and the backend bridge supplies its current record and existing log data. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:64-103; packages/ui/src/web-client-bridge.ts:1-20, 107-139] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Existing class-switch modules | in repo | Class ordering, eligibility filters, bench state, notice state | The locked implementation seam places new class-switch behavior under `packages/core/src/class-switch/`. No new package is needed. [VERIFIED: .planning/research/FORK-SEAMS.md, “New directory”] |
| Node.js | v22.23.2 available; project engine `>=22` | Core runtime and test runner | Both root and core package declare Node `>=22`; this session's environment reports v22.23.2. [VERIFIED: package.json:26-28; packages/core/package.json:10-12; environment probe] |
| `node:test` + `node:assert/strict` | Node v22.23.2 | Core unit tests | Phase 2 and the testing guide use the built-in runner and strict assertions. [VERIFIED: .planning/codebase/TESTING.md:9-24; .planning/phases/02-live-choice/02-VALIDATION.md:16-23] |
| React / React DOM | 18.3.1 installed | Management UI components and static-render component tests | Existing UI components and component tests use React and `renderToStaticMarkup`. [VERIFIED: packages/ui/package.json:20-22; packages/ui/test/component/layout.test.tsx:1-5] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 1.20.0 installed | `ArrowDown` notice icon | Use the icon specified by the UI contract. [VERIFIED: packages/ui/package.json:18-20; .planning/phases/03-step-down/03-UI-SPEC.md:75-87] |
| `motion` | 12.40.0 installed | Banner entrance transition and reduced-motion support | Reuse the existing motion pattern required by the UI contract. [VERIFIED: packages/ui/package.json:19-21; .planning/phases/03-step-down/03-UI-SPEC.md:31-33, 87] |
| Tailwind CSS | 4.3.1 installed | Existing UI styles | Reuse existing token classes and warning-surface utility; do not add hard-coded colors. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:30-32, 51-60; environment `npm ls`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One ordered attempt list consumed by the parent loop | Call the class policy again after each refusal | A second policy call changes the locked seam design and can duplicate planning work; the parent loop already walks a list. [VERIFIED: .planning/research/FORK-SEAMS.md, “What this does not do”] |
| A one-record notice exposed through existing IPC/RPC | New UI page, log schema, or polling timer | These add surfaces and state not required by the UI contract; the contract requires the existing layout and 2-second runtime-status poll. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:15, 59, 66-103] |

**Installation:**

```bash
# No package installation required.
```

## Package Legitimacy Audit

No external packages are required by the phase; no legitimacy check or registry install is applicable. Existing runtime package versions were read from the project metadata and installed tree. [VERIFIED: package.json:79-115; packages/ui/package.json:12-26; environment `npm ls`]

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
Claude Code request
  | model name + request scalars
  v
createRouteExecutionPlan -> applyShelf
  | CCR_CLASS_SWITCH=0 or non-class request -> parent plan unchanged
  | class request -> eligible attempts ordered by requested class, then lower classes
  | message body remains outside attemptsForClass
  v
parent fetchUpstreamWithFallback
  | tries current-class attempts first; then lower-class attempts
  | first successful attempt terminates the list walk
  v
request pipeline
  | response body keeps Claude's requested model name
  | response carries requested/served model headers
  | actual lower-class success updates the current swap notice
  +------------------------------+
  |                              |
  v                              v
existing request log         notice.ts current record
  |                              |
  +---- management IPC/RPC read -+
                 |
                 v
     window.ccr.getSwapNotice()
                 |
                 v
     2-second runtime-status poll
                 |
                 v
     banner + SD pill + expanded log details
```

The existing plan-to-executor path builds the list once, and the request pipeline already has the client-visible model rewrite point. [VERIFIED: packages/core/src/routing/execution-plan.ts:9-40; .planning/research/FORK-SEAMS.md, “One request”; packages/core/src/gateway/request/pipeline.ts:827-829, 1032-1034]

### Recommended Project Structure

```text
packages/core/src/class-switch/
├── notice.ts                 # one current swap record and live-again clearing
├── plan.ts                   # ordered lower-class attempts using existing filters
└── seam.ts                   # narrow exports for parent calls

packages/core/test/unit/class-switch/
└── step-down.test.mjs        # class ordering, empty state, identity, notice lifecycle

packages/ui/src/pages/home/
├── App.tsx                   # poll notice inside refreshRuntimeStatus
└── components/
    ├── layout.tsx            # persistent SwapNoticeBanner
    └── network-logs.tsx      # SD pill and expanded step-down detail
```

The `notice.ts` module and UI work are specified by the locked fork seam and approved UI design contract; test naming follows the existing `packages/core/test/unit/class-switch/*.test.mjs` convention. [VERIFIED: .planning/research/FORK-SEAMS.md, “New directory” and “Seams”; .planning/codebase/TESTING.md:66-111; .planning/phases/03-step-down/03-UI-SPEC.md:66-103]

### Pattern 1: Ordered fallback in one plan

Keep the exact class order defined by the source type:

> `export type ShelfClass = "fable" | "opus" | "sonnet" | "haiku";` [VERIFIED: packages/core/src/class-switch/catalog.ts:26]

Build eligible attempt rows for the requested class first, then append each lower class in order. Reuse the same parsed request flags and scalar inputs for every shelf. Keep each shelf's current score/filter/token ordering. Do not mix a lower-class row ahead of a still-eligible requested-class row. The existing executor consumes the resulting attempt list. [VERIFIED: packages/core/src/class-switch/plan.ts:271-309, 312-399; .planning/research/FORK-SEAMS.md, “One request”]

The decision is class-based: if any requested-class attempt succeeds, the parent loop stops before a lower-class attempt; if the requested class has no eligible attempt, the next class becomes the first attempt. Continue down only when prior attempts do not succeed. This is the narrow behavior that satisfies both class priority and the existing pre-token refusal path. [VERIFIED: .planning/REQUIREMENTS.md:35-37; .planning/research/FORK-SEAMS.md, “One request”]

### Pattern 2: One current notice record

The UI contract defines this shape verbatim:

> `SwapNotice = { requestedClass, servedClass, model, provider, credentialLabel, reason, sinceAt, safeguardsApplies }` [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:90]

Record only a real served swap; return `null` when no swap is active. Keep the credential display value as a label/slug, never the API key. Set `safeguardsApplies` from the actual served provider so the UI can show the fixed safeguards notice only for non-Anthropic providers. The contract's canonical banner text is `Opus is replaced by Sonnet since 15:02`. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:84-92, 154-170; .planning/research/FORK-SEAMS.md, “Seams”]

The notice read must reconcile the saved current swap against the requested class's live-again condition. Reuse the existing visible poll rather than adding a timer: `App.tsx` already calls `startVisiblePolling(refreshRuntimeStatus, 2000)`. [VERIFIED: packages/ui/src/pages/home/App.tsx:366-384]

### Pattern 3: Extend existing bridges and logs

The bridge's `CcrApi` type is derived from `Window["ccr"]`, and the web RPC already has an authenticated `rpc()` helper. Add one read method consistently to the shared UI type, Electron preload/IPC, and management-server RPC map; keep the method read-only. [VERIFIED: packages/ui/src/web-client-bridge.ts:1-20, 107-139; packages/ui/src/types/electron.d.ts:91-129; packages/electron/src/main/preload.ts:106-139; packages/electron/src/main/ipc.ts:121-128; packages/core/src/web/management-server.ts:318-345]

For the request log, use existing `RequestLogEntry` fields (`requestedModel`, `resolvedModel`, `responseModel`, `provider`, `credentialId`, `responseHeaders`, and `routeTrace`) and the existing route-trace decision reason. The UI contract explicitly says no log schema change; it derives the `SD` pill from requested/resolved class mismatch and renders the reason only when route-trace data is present. [VERIFIED: packages/core/src/contracts/app.ts:2131-2144, 2229-2276; .planning/phases/03-step-down/03-UI-SPEC.md:94-103, 182-204]

**Anti-Patterns to Avoid**

- **Adding lower-class attempts in Phase 2's path or when the feature is disabled:** preserve `CCR_CLASS_SWITCH=0` and non-class behavior. [VERIFIED: packages/core/src/class-switch/seam.ts:224-243; .planning/research/FORK-SEAMS.md, “Rule”]
- **Calling the policy from inside the refusal loop:** build the list once and use the parent loop. [VERIFIED: .planning/research/FORK-SEAMS.md, “What this does not do”]
- **Passing request messages/body to class policy:** continue to pass scalar facts only. [VERIFIED: packages/core/src/class-switch/plan.ts:312-318, 356-399; .planning/phases/03-step-down/03-CONTEXT.md:27-33]
- **Changing `UpstreamAttempt`, `credential-pool.ts`, `config.ts`, or `profiles/service.ts`:** these are outside the locked seam allowlist. [VERIFIED: .planning/research/FORK-SEAMS.md, “Rule”]
- **Duplicating step-down information in a new request-log schema:** use the existing response headers and log fields. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:94-103]
- **Using a hard-coded warning color or `Badge variant="warning"` for the banner:** the UI contract requires token-aware `network-body-warning` for both themes. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:31, 51-60, 138-150]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request retry/fallback loop | A second loop or a re-run of class policy | Existing `fetchUpstreamWithFallback` over the ordered list | The fork seam assigns list traversal to the parent loop. [VERIFIED: .planning/research/FORK-SEAMS.md, “One request” and “What this does not do”] |
| Existing class eligibility | A separate liveness/choice implementation | Existing `attemptsForClass` filters and bench checks, factored if needed | It already filters bench, credentials, tools, images, context, and orders rows. [VERIFIED: packages/core/src/class-switch/plan.ts:113-159, 271-309, 356-399] |
| Request log data | New step-down columns or a second log row | Existing `RequestLogEntry`, response headers, and `routeTrace` | The UI contract requires no schema change. [VERIFIED: packages/core/src/contracts/app.ts:2229-2276; .planning/phases/03-step-down/03-UI-SPEC.md:94-103] |
| Management polling | A new timer | Existing `refreshRuntimeStatus` 2-second loop and `preserveEqualPollingSnapshot` | The design contract explicitly places the read in the existing poll. [VERIFIED: packages/ui/src/pages/home/App.tsx:366-384; .planning/phases/03-step-down/03-UI-SPEC.md:59, 90] |
| Credential masking | New key formatter | Existing credential slug/label only | Notice and logs must never expose the raw provider key. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:84, 92, 170; .planning/phases/02-live-choice/02-RESEARCH.md:469-478] |

**Key insight:** Phase 3 needs to change the ordered candidate list and record which lower class actually served. It does not need a new router, fallback loop, request-log model, or UI polling mechanism. [VERIFIED: .planning/research/FORK-SEAMS.md; .planning/phases/03-step-down/03-UI-SPEC.md]

## Common Pitfalls

### Pitfall 1: Return only the first lower shelf

**What goes wrong:** If the requested class has attempts that all refuse and only the first lower class is listed, an available model on a still-lower class cannot serve. [VERIFIED: .planning/REQUIREMENTS.md:35-37; .planning/research/FORK-SEAMS.md, “One request”]
**Why it happens:** The parent executor consumes a fixed list; it does not re-run the policy after each refusal. [VERIFIED: .planning/research/FORK-SEAMS.md, “What this does not do”]
**How to avoid:** Append all lower classes in rank order to the same plan, with current-class rows first and the existing row ordering preserved. [VERIFIED: .planning/research/FORK-SEAMS.md, “One request”]
**Warning signs:** A lower-class fixture succeeds alone but the gateway still returns “All target providers failed” after higher-class rows fail. [VERIFIED: .planning/REQUIREMENTS.md:37]

### Pitfall 2: Lower class precedes an eligible requested-class triple

**What goes wrong:** An available lower-class model gets sent before a requested-class model. [VERIFIED: .planning/REQUIREMENTS.md:35]
**Why it happens:** A fixed global shelf order would not start at the requested class. [VERIFIED: .planning/REQUIREMENTS.md:35; .planning/phases/03-step-down/03-CONTEXT.md:12-15]
**How to avoid:** Add table-driven tests where one requested-class model is eligible and multiple lower classes are also populated; assert the requested-class row is first and a successful response stops there. [VERIFIED: .planning/phases/03-step-down/03-CONTEXT.md:12-17; .planning/research/FORK-SEAMS.md, “One request”]
**Warning signs:** The first attempt model belongs to any lower class when the requested class has an eligible triple. [VERIFIED: .planning/REQUIREMENTS.md:35]

### Pitfall 3: Notice lifecycle does not match routing liveness

**What goes wrong:** The notice remains after the requested class becomes live, or disappears while it is still unavailable. [VERIFIED: .planning/REQUIREMENTS.md:36]
**Why it happens:** If notice reads do not reconcile with current class liveness, a prior record may remain after recovery. [ASSUMED]
**How to avoid:** Reconcile the current notice with class liveness when it is read and when relevant shelf/bench state changes; have the existing poll receive `null` after recovery. Confirm the exact liveness definition in the plan. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:88-92]
**Warning signs:** A UI test restores a live triple, but `getSwapNotice()` still returns the old record. [ASSUMED]

### Pitfall 4: Expose or persist a provider secret as the token label

**What goes wrong:** The notice or log includes an API key. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:92, 170]
**Why it happens:** Code uses the provider credential value instead of the existing credential id/label. [VERIFIED: .planning/phases/02-live-choice/02-RESEARCH.md:469-478]
**How to avoid:** Carry only `credentialLabel`/credential slug into the notice and tests; assert the fixture API key is absent from rendered markup and logs. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:84, 92]
**Warning signs:** A fixture key string appears in serialized notice JSON, log details, or UI markup. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:92, 170]

### Pitfall 5: UI reads work in desktop but not standalone management mode

**What goes wrong:** Desktop UI gets the notice but the management web UI does not. [VERIFIED: packages/electron/src/main/preload.ts:106-139; packages/core/src/web/management-server.ts:318-345]
**Why it happens:** The read was added to Electron IPC/preload but omitted from `CcrApi`, `web-client-bridge.ts`, or the management-server handler map. [VERIFIED: packages/ui/src/web-client-bridge.ts:1-20, 107-139]
**How to avoid:** Add the same read-only API through all existing surfaces and test its RPC mapping. [VERIFIED: packages/electron/src/main/ipc.ts:121-128; packages/core/src/web/management-server.ts:318-345]
**Warning signs:** TypeScript says `window.ccr` has the method, but the web bridge lacks the implementation or RPC returns 404/unknown method. [VERIFIED: packages/ui/src/web-client-bridge.ts:1-20, 107-139]

## Code Examples

### Preserve the current empty-shelf contract until step-down is explicitly enabled

Current behavior is:

> `return attempts.length ? attempts : undefined;` [VERIFIED: packages/core/src/class-switch/plan.ts:397-399]

In Phase 3, wrap or factor this single-shelf operation so the class-request path can append lower-class attempts. Keep the Phase 2 call path unchanged when `CCR_CLASS_SWITCH=0`; `applyShelf` currently returns the parent plan before parsing or replacing attempts in that mode. [VERIFIED: packages/core/src/class-switch/seam.ts:224-243]

### Keep the response body identity separate from the served route

The current pipeline selects:

> `const clientVisibleResponseModel = requestedModel ?? routedModel;` [VERIFIED: packages/core/src/gateway/request/pipeline.ts:827-829]

It then rewrites the Anthropic response model to `clientVisibleResponseModel`. Keep that behavior; report the actual served route through the separate requested/served headers and the notice. [VERIFIED: packages/core/src/gateway/request/pipeline.ts:1029-1034; .planning/REQUIREMENTS.md:35-36]

### Poll notice with existing runtime status

The design contract requires one `window.ccr.getSwapNotice(): Promise<SwapNotice | null>` read inside the existing `refreshRuntimeStatus` poll. Keep `window.ccr` absence and rejected reads non-fatal; the banner should render nothing without a notice. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:68-92; packages/ui/src/pages/home/App.tsx:366-384]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 2 keeps the parent plan when the requested shelf has no eligible attempt | Phase 3 deliberately adds lower-class attempts behind the class-switch seam | Phase 3 | An empty higher shelf can be served by a lower class without changing the parent request loop. [VERIFIED: packages/core/src/class-switch/seam.ts:232-243; .planning/phases/03-step-down/03-CONTEXT.md:27-33] |
| No notice state exists in Phase 2 | One current notice record is exposed to the management UI | Phase 3 | User can see the actual requested class, served class, model, credential label, reason, and safeguards limitation. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:84-103] |
| No step-down headers | `x-ccr-requested-model` and `x-ccr-served-model` on step-down responses | Phase 3 | Existing response-header details display them without a log schema addition. [VERIFIED: .planning/REQUIREMENTS.md:36; .planning/phases/03-step-down/03-UI-SPEC.md:101-103] |

**Deprecated/outdated:**

- Phase 2's “do not append Sonnet or Haiku” prohibition applied only to Phase 2. Phase 3 is the deliberate step-down phase; preserve all unrelated Phase 2 prohibitions. [VERIFIED: .planning/phases/02-live-choice/02-RESEARCH.md:597-602; .planning/phases/03-step-down/03-CONTEXT.md:27-33]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` for core; existing UI component tests use React static rendering. [VERIFIED: .planning/codebase/TESTING.md:9-24, 290-306] |
| Config file | `build/test.mjs` compiles tests; `build/run-tests.mjs` runs compiled tests. [VERIFIED: .planning/codebase/TESTING.md:9-20, 56-61] |
| Quick run command | `npm run test:unit -w @claude-code-router/core` [VERIFIED: packages/core/package.json:13-16] |
| UI component command | `npm run test:component -w @claude-code-router/ui` [VERIFIED: packages/ui/package.json:6-10] |
| Architecture command | `npm run test:architecture` [VERIFIED: package.json:60-66] |
| Full suite command | `npm test` [VERIFIED: package.json:60-66] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FALL-01 | Eligible requested-class rows precede all lower classes; with requested class empty, the next lower live triple returns success; response body retains Claude's requested model. | unit + executor integration-style stub | `npm run test:unit -w @claude-code-router/core` | ❌ Add step-down cases to `packages/core/test/unit/class-switch/choice.test.mjs` or a new class-switch test. |
| FALL-02 | Notice data includes requested/served classes, served model, credential label, reason, and safeguards applicability; notice clears after the requested class regains a live triple; both headers are present together. | core unit + UI component + bridge test | `npm run test:unit -w @claude-code-router/core` and `npm run test:component -w @claude-code-router/ui` | ❌ Add core notice and UI component cases. |
| FALL-03 | A lower class can succeed after higher-class attempts fail; an error is terminal when no class has an eligible live attempt. | unit + executor integration-style stub | `npm run test:unit -w @claude-code-router/core` | ❌ Add ordered-list and all-classes-empty cases. |

The core test convention is flat `test()` calls, strict assertions, `.mjs` files under `packages/core/test/unit/`, and test imports with `.ts` extensions. [VERIFIED: .planning/codebase/TESTING.md:66-111, 132-159]

### Sampling Rate

- **Per core task commit:** `npm run test:unit -w @claude-code-router/core` [VERIFIED: .planning/phases/02-live-choice/02-VALIDATION.md:28-33]
- **After UI tasks:** `npm run test:component -w @claude-code-router/ui` [VERIFIED: packages/ui/package.json:6-10]
- **Per wave merge:** core unit suite, UI component suite, and `npm run test:architecture`. [VERIFIED: package.json:60-66; packages/ui/package.json:6-10]
- **Phase gate:** `npm test`; run `npm run test:e2e` if the implementation changes the web RPC surface, as the project testing guide recommends for RPC changes. [VERIFIED: package.json:60-70; .planning/codebase/TESTING.md:308-314]

### Wave 0 Gaps

- [ ] Add failing core tests for ordered class fallback, requested-class priority, all-class exhaustion, and the disabled gate; store RED output and run `gsd_run check tdd-red-evidence` before implementation, following the Phase 2 TDD pattern. [VERIFIED: .planning/phases/02-live-choice/02-01-PLAN.md:124-159; .planning/phases/02-live-choice/02-04-PLAN.md:131-170]
- [ ] Add tests for notice record creation, one-current-record behavior, and clear-on-live-again.
- [ ] Add UI component tests for banner absence, safeguards copy condition, `SD` pill, and expanded details. The component-test pattern is `renderToStaticMarkup` plus assertions. [VERIFIED: packages/ui/test/component/layout.test.tsx:70-88; .planning/codebase/TESTING.md:290-306]
- Framework install: none. Existing Node and UI test runners are present. [VERIFIED: packages/core/package.json:13-16; packages/ui/package.json:6-10]

## Security Domain

The phase changes server-side routing and exposes a read-only notice to the management UI. OWASP identifies ASVS as a framework for designing, developing, and testing web application and web-service security; the current OWASP page identifies ASVS 5.0.0 as the stable release, published 30 May 2025. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new authentication path | Preserve the existing management service authentication; this feature adds a read-only response. [VERIFIED: packages/ui/src/web-client-bridge.ts:3-20; packages/core/src/web/management-server.ts:318-345] |
| V3 Session Management | No new authentication-session behavior | Do not use request message/session content as notice data; the class policy remains scalars-only. [VERIFIED: packages/core/src/class-switch/plan.ts:312-318, 356-399] |
| V4 Access Control | Yes, management read surface | Add only the intended read API; keep it behind the existing IPC/web RPC boundaries. [VERIFIED: packages/electron/src/main/ipc.ts:121-128; packages/core/src/web/management-server.ts:318-345] |
| V5 Input Validation | Yes | Limit notice values to known shelf classes and validated model/provider/credential labels; do not render raw keys or arbitrary provider response text. [VERIFIED: packages/core/src/class-switch/catalog.ts:26-43; .planning/phases/03-step-down/03-UI-SPEC.md:84-92, 170] |
| V6 Cryptography | No new cryptographic operation | Do not add token storage or cryptographic code; rely on the existing web-auth path. [VERIFIED: packages/ui/src/web-client-bridge.ts:3-20] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Raw provider key copied into notice/log | Information disclosure | Use only the existing credential slug/label; assert the fixture key is absent. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:84, 92, 170] |
| Request body passed into class policy or notice | Information disclosure | Keep policy input scalars-only; notice stores routing facts only. [VERIFIED: .planning/phases/03-step-down/03-CONTEXT.md:27-33; packages/core/src/class-switch/plan.ts:312-318] |
| Untrusted provider/model/reason strings rendered as markup | Tampering / XSS | Render through React text nodes; use existing i18n `t()` and token-based CSS classes; never inject HTML. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:30-33, 84-92, 150-170] |
| Desktop/web bridge parity missing | Access control / integrity | Expose one read method through the existing typed IPC and authenticated RPC mapping; do not add an unauthenticated route. [VERIFIED: packages/ui/src/web-client-bridge.ts:3-20, 107-139; packages/electron/src/main/preload.ts:106-139] |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Core runtime and test build | ✓ | v22.23.2 | — |
| npm | Workspace test commands | ✓ | 12.2.2 | — |
| External model provider | Automated phase validation | Not required | — | Stub `fetch`; no live provider call. [VERIFIED: .planning/codebase/TESTING.md:205-215; .planning/phases/02-live-choice/02-VALIDATION.md:62-65] |

No missing dependency blocks the phase. [VERIFIED: environment probe; package scripts in packages/core/package.json:13-16 and packages/ui/package.json:6-10]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] A request whose requested-class attempts all refuse may continue to lower-class attempts in the same precomputed list; it must not invoke class policy again inside the loop. | Summary; Pattern 1 | A stricter interpretation of “requested class wins” could require an error after requested-class refusals, which would conflict with the lower-class availability requirement. |
| A2 | [ASSUMED] The two response-header values should identify the original Claude model and the final served route model; the UI derives requested and served class labels from request-log data. | Pattern 3; Code Examples | A different exact value format could break clients or header-table interpretation. |
| A3 | [ASSUMED] When concurrent requests would create different swaps, one current notice record needs a deterministic replacement policy (recommended: record the most recent successful swap). | Pattern 2 | A singleton record could otherwise flap or hide an active swap for another requested class. |
| A4 | [ASSUMED] “Anthropic provider” for `safeguardsApplies` should be derived from the resolved provider's effective protocol/type, not a display-name substring. | Pattern 2 | A custom provider name or protocol alias could show or hide the safeguards line incorrectly. |
| A5 | [ASSUMED] A process-local notice is sufficient; after restart, a new request can recreate the record if the swap still holds. | Pattern 2 | A user may expect the notice to survive restart without an ongoing request. |
| A6 | [ASSUMED] If notice reads do not reconcile with current class liveness, a prior record may remain after recovery. | Pitfall 3 | Users may continue to see a stale notice after a model is live again. |
| A7 | [ASSUMED] A UI test can restore a live triple while `getSwapNotice()` still returns the previous record if the recovery predicate is not run. | Pitfall 3 | Recovery bugs may not be caught by tests that only exercise route planning. |
| A8 | [ASSUMED] Class-level shelf/credential/bench liveness is the correct recovery predicate for a persistent notice. | Open Question 2 | Request-specific capability differences could make the notice clear too early or too late. |

## Open Questions

1. **What exact model strings go in the two headers?**
   - What we know: The requirement names `x-ccr-requested-model` and `x-ccr-served-model`; the response body must retain Claude's requested model name. [VERIFIED: .planning/REQUIREMENTS.md:35-36]
   - What's unclear: Whether `x-ccr-served-model` contains the provider-qualified route selector or a Claude class/model alias.
   - Recommendation: Use original request model and the final selected route model, respectively, and test that the two headers are set together. Confirm the exact values against the project's header convention before locking the plan. [ASSUMED]

2. **What is the precise “live again” predicate?**
   - What we know: The notice clears when the requested higher class has a live triple again. The existing plan filters credentials, bench state, tool/image support, and context length. [VERIFIED: .planning/REQUIREMENTS.md:36; packages/core/src/class-switch/plan.ts:113-159, 356-399]
   - What's unclear: Whether notice recovery checks any class-level live triple or one eligible for the request that created the notice.
   - Recommendation: Use class-level shelf/credential/bench liveness for clearing the persistent notice, and reconcile during notice reads and relevant class-switch state updates. Mark this predicate in tests. [ASSUMED]

3. **How should simultaneous swaps share the single notice?**
   - What we know: The UI data contract describes one current swap record. [VERIFIED: .planning/phases/03-step-down/03-UI-SPEC.md:90]
   - What's unclear: The replacement/priority rule if requests for different classes step down concurrently.
   - Recommendation: Record the most recent successful swap and make the behavior deterministic. [ASSUMED]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/03-step-down/03-CONTEXT.md` — phase boundary and locked inherited constraints.
- `.planning/REQUIREMENTS.md` — FALL-01 through FALL-03.
- `.planning/research/FORK-SEAMS.md` — allowed parent seams and single-list request flow.
- `packages/core/src/class-switch/plan.ts`, `seam.ts`, `catalog.ts` — current class selection, empty-plan behavior, scalar policy input, and gate.
- `packages/core/src/gateway/request/pipeline.ts` — client-visible response model and response handling.
- `.planning/phases/03-step-down/03-UI-SPEC.md` — approved notice data shape and UI behavior.
- `.planning/codebase/TESTING.md` and `.planning/phases/02-live-choice/02-VALIDATION.md` — test runner and sampling pattern.

### Secondary (MEDIUM confidence)

- [OWASP ASVS project page](https://owasp.org/www-project-application-security-verification-standard/) — ASVS purpose and current stable version.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies, engine constraints, and installed versions were checked in project files and the current environment.
- Architecture: HIGH for repository boundaries and current code paths; MEDIUM for the exact step-down and notice concurrency/liveness choices.
- Pitfalls: MEDIUM — grounded in the phase requirements and existing seam design; future-state choices remain assumptions.

**Research date:** 2026-11-15  
**Valid until:** 2026-12-15, unless the fork seam or the UI contract changes.

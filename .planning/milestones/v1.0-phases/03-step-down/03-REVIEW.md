---
phase: 03-step-down
reviewed: 2026-11-15T11:18:35Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - packages/core/src/class-switch/notice.ts
  - packages/core/src/class-switch/plan.ts
  - packages/core/src/class-switch/seam.ts
  - packages/core/src/contracts/app.ts
  - packages/core/src/contracts/ipc-channels.ts
  - packages/core/src/gateway/request/pipeline.ts
  - packages/core/src/web/management-server.ts
  - packages/core/test/support/step-down-request-log-home.mjs
  - packages/core/test/unit/class-switch/choice.test.mjs
  - packages/core/test/unit/class-switch/plan.test.mjs
  - packages/core/test/unit/class-switch/step-down.test.mjs
  - packages/core/test/unit/web/web-management-server.test.mjs
  - packages/electron/src/main/ipc.ts
  - packages/electron/src/main/preload.ts
  - packages/electron/test/unit/swap-notice-ipc.test.mjs
  - packages/ui/src/pages/home/App.tsx
  - packages/ui/src/pages/home/components/layout.tsx
  - packages/ui/src/pages/home/components/network-logs.tsx
  - packages/ui/src/pages/home/shared/i18n.tsx
  - packages/ui/src/types/electron.d.ts
  - packages/ui/src/web-client-bridge.ts
  - packages/ui/test/component/layout.test.tsx
  - packages/ui/test/component/observability.test.tsx
  - packages/ui/test/integration/web-client-bridge.test.ts
findings:
  critical: 5
  warning: 5
  info: 1
  total: 11
  necessity: 0
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-15T11:18:35Z
**Depth:** deep
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed all 24 files at deep depth and traced the planner into the parent executor, pipeline response paths, request-log persistence, provider identity resolution, Electron/web transports, and UI rendering. The principal risks are not surface style issues: the notice can be lost or misclassified, `CCR_CLASS_SWITCH=0` changes upstream headers, and supported external-gateway adoption leaves the management UI reading an empty process-local store. Log rendering also reasons about provider display names rather than the provider identity used by core. No necessity finding was provable from the repository.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — An asynchronous notice read can erase a newer swap or return stale state

**File:** `packages/core/src/class-switch/notice.ts:84-94`
**Issue:** `readSwapNotice()` captures `currentSwapNotice` and then awaits `loadAppConfig()` at line 89 when no registry is injected (the normal management-server and Electron paths). A successful request can replace the singleton during that await. The read then evaluates liveness for the old class and, at lines 90-92, unconditionally clears the singleton. This can delete a newer, unrelated swap. If the old class is not live, line 94 returns the old record even though a newer one has already won. This violates the latest-success and notice-lifecycle contracts.

**Fix:** Only clear or return the captured record if it is still current; otherwise use the replacement rather than applying the old record's decision to it.

```ts
const record = currentSwapNotice;
if (!record) return null;
const registry = options.modelRegistry ?? modelRegistryForConfig(await loadAppConfig());
if (hasLiveTripleForClass(record.requestedClass, registry)) {
  if (currentSwapNotice === record) {
    currentSwapNotice = null;
    return null;
  }
  return currentSwapNotice;
}
return currentSwapNotice === record ? record : currentSwapNotice;
```

Add a regression that delays the config read, records an Opus swap, starts `readSwapNotice()`, records a Fable swap, and then resolves the read. The Fable record must survive and be returned; it must not be cleared by Opus recovery.

### CR-02: BLOCKER — Tool-turn stickiness labels a lower-class target as the requested class

**File:** `packages/core/src/class-switch/plan.ts:446-455`
**Issue:** After a step-down succeeds, the executor remembers the served provider/model/credential (`executor.ts:575-581`). On the next tool turn, `toolTurnAttempt()` resolves that lower-class target, but lines 450-453 write `parsed.shelfClass` into `targetShelfByReference`. `recordStepDownSuccess()` consequently sees the target as same-class and returns null (`notice.ts:60-62`), so the lower-class response loses both `x-ccr-*` headers and no current swap is recorded. Existing older notice state can also remain inconsistent with the actual response.

**Fix:** Determine the sticky target's shelf from the current snapshot using its provider/model pair, and store that shelf, never `parsed.shelfClass`. Share a snapshot-based target-to-shelf helper with the normal planner path. If the target cannot be found, do not invent a class.

```ts
const servedClass = shelfClassInSnapshot(snapshot, sticky[0]?.target);
if (servedClass && sticky[0]?.target) {
  targetShelfByReference.set(sticky[0].target, servedClass);
}
```

Add a two-request regression: an initial Opus request is served by Sonnet with a session id, then a tool-result-only turn uses the remembered Sonnet triple. The second response must still produce an Opus-to-Sonnet notice and both headers.

### CR-03: BLOCKER — The kill switch still strips upstream headers

**File:** `packages/core/src/gateway/request/pipeline.ts:859-864`
**Issue:** Both disclosure headers are deleted on every response without checking `CCR_CLASS_SWITCH`. Parent behavior without this phase would forward an upstream's `x-ccr-requested-model` and `x-ccr-served-model`; therefore `CCR_CLASS_SWITCH=0` does not keep exact parent behavior, which is a locked constraint. The existing kill-switch tests cover attempt planning but not this response path.

**Fix:** Gate all phase-added header manipulation and notice recording on the switch. With the switch off, do not delete or add these headers.

```ts
const classSwitchEnabled = process.env.CCR_CLASS_SWITCH !== "0";
if (classSwitchEnabled) {
  responseHeaders.delete("x-ccr-requested-model");
  responseHeaders.delete("x-ccr-served-model");
}
if (classSwitchEnabled && upstreamResponse.ok) {
  // recordStepDownSuccess(...) and paired-header writes
}
```

Add a response-path regression with `CCR_CLASS_SWITCH=0` and both headers supplied upstream: the client response must retain the exact upstream values.

### CR-04: BLOCKER — Log safeguards are inferred from a display name, not provider identity

**File:** `packages/ui/src/pages/home/components/network-logs.tsx:1589-1599`
**Issue:** Line 1598 treats a provider as Anthropic only when `entry.provider.toLowerCase() === "anthropic"`. However, `resolveProviderLogName()` returns the configured display name (`runtime-topology.ts:485-500`). A valid provider such as `{ name: "AnthropicShim", provider: "anthropic" }` is explicitly treated as Anthropic by `notice.ts:42-45` and by the core test at `step-down.test.mjs:838-856`, but its request log uses `entry.provider === "AnthropicShim"`. The expanded log therefore displays “Auto mode will not receive Anthropic safeguards from this non-Anthropic provider” for an actual Anthropic provider. This violates the locked safeguards constraint and can disagree with the banner for the same swap.

**Fix:** Resolve the request-log provider back to its `GatewayProviderConfig` and apply the same identity predicate used by core (`provider.provider`, with the documented explicit-`type` behavior), rather than inspecting `entry.provider` text. `App.tsx` already owns `draftConfig.Providers`; pass the relevant config through `LogsView`/`LogExpandedDetails` instead of adding a request-log schema field. Extract the core predicate into a shared helper so banner and log semantics cannot drift.

```tsx
const providerConfig = providers.find((candidate) => candidate.name === entry.provider);
const safeguardsApplies = providerConfig ? safeguardsAppliesForProvider(providerConfig) : false;
```

Add a rendering regression using `name: "AnthropicShim"`, `provider: "anthropic"` and require the safeguards warning to be absent. Keep the existing non-Anthropic `anthropic_messages` protocol case as a negative control.

### CR-05: BLOCKER — Externally managed gateways cannot surface their swap notice in the management UI

**File:** `packages/core/src/class-switch/notice.ts:26,84-99`; `packages/core/src/gateway/application/gateway-service.ts:698-711`; `packages/core/src/web/management-server.ts:345`
**Issue:** The only notice record is process-local. `markExternalGatewayRunning()` adopts an existing gateway on another process and sets the local `server` to undefined. Requests then execute in that external runtime's `GatewayRequestPipeline`, so `recordStepDownSuccess()` updates the external process's singleton. The local management RPC and Electron IPC still call `getSwapNotice()` against the local singleton, which remains null. The scoped management test itself establishes that adopting a healthy external gateway is a supported mode (`web-management-server.test.mjs:69-141`). In this mode the phase goal's user-visible notice never arrives locally.

**Fix:** Make the executing runtime the notice source of truth in adopted mode. Proxy/subscribe `getSwapNotice` through an authenticated runtime management/core channel instead of reading the local singleton when `gatewayManagedExternally` is true, and update/clear the local projection from the external record. Preserve the scalar-only payload. Add an integration test where an adopted runtime performs a real step-down and the local UI's `getSwapNotice()` returns and subsequently reconciles that runtime's notice.

## Warnings

### WR-01: WARNING — Any lower-class failure is misreported as failure of the requested class

**File:** `packages/core/src/gateway/request/pipeline.ts:926-930`; `packages/core/src/class-switch/notice.ts:64-66`
**Issue:** `hadRequestedClassFailure` is computed as `upstreamResult.failedAttempts.length > 0`. Failed entries include lower-class attempts. With an empty Opus shelf, if the first Sonnet attempt fails and a later Sonnet attempt succeeds, the reason becomes “all Opus attempts refused before first token” even though no Opus attempt occurred. The reason should remain “no live Opus triple”.

**Fix:** Track whether a failed attempted target belongs to the requested shelf while that target and its shelf are known, and pass that request-scoped fact instead of the global failure count. Do not inspect provider error text or message bodies.

```ts
hadRequestedClassFailure: hasRequestedClassFailure(upstreamResult)
```

Add a regression with no Opus rows and Sonnet responses `[429, 200]`; assert the `no live Opus triple` reason. Retain a separate Opus-refusal then Sonnet-success case for the other phrase.

### WR-02: WARNING — Expanded log Reason selects an unrelated fallback decision

**File:** `packages/ui/src/pages/home/components/network-logs.tsx:1582-1588`
**Issue:** The helper keeps the last nonempty `decision.reason` from any route hop. Every real executor plan captures a late `fallback.execution-plan` decision whose reason is `fallback:off`, `fallback:retry`, or `fallback:model-chain` (`executor.ts:378-387`). Attempt hops do not replace this with the notice reason. Consequently a real expanded step-down log displays a generic fallback mode rather than “no live Opus triple” or the refusal phrase. The current UI fixture omits the production `fallback.execution-plan` hop and therefore misses this defect.

**Fix:** Select only an explicitly marked class-switch decision, never an arbitrary last reason, and emit that marked decision with the fixed notice reason when the actual swap is recorded. If no class-switch reason exists, omit Reason as the partial-data contract requires.

```tsx
const hop = [...(entry.routeTrace?.hops ?? [])]
  .reverse()
  .find((candidate) => candidate.decision?.source === "class-switch" && candidate.decision.reason?.trim());
const reason = hop?.decision?.reason?.trim();
```

Add a production-shaped trace containing a subsequent `fallback.execution-plan` hop and assert that its text never becomes the step-down Reason.

### WR-03: WARNING — Ordinary model-chain fallbacks are falsely marked as class-switch swaps

**File:** `packages/ui/src/pages/home/components/network-logs.tsx:1576-1600`
**Issue:** SD rendering is gated only by class-like names in `requestedModel` and `resolvedModel`. For example, the parent's ordinary `model-chain` can route `claude-opus-4-6` to `Provider/claude-sonnet-4` without the class-switch planner. Core emits the paired `x-ccr-*` headers only for an actual recorded swap (`pipeline.ts:921-937`), but the UI ignores that evidence and creates an SD pill and warning block anyway. This produces a notice when no phase-03 swap occurred and can attach unrelated route reasons.

**Fix:** Require the paired headers as authenticity evidence before constructing SD details; continue deriving the two class names from `requestedModel`/`resolvedModel` as before, rather than deriving classes from the headers. Missing or contradictory evidence must suppress the UI.

```tsx
const requestedEvidence = firstHeaderValue(entry.responseHeaders["x-ccr-requested-model"]);
const servedEvidence = firstHeaderValue(entry.responseHeaders["x-ccr-served-model"]);
if (!requestedEvidence || !servedEvidence) return null;
```

Add a regression for a parent `model-chain` Opus-to-Sonnet response with no paired headers and require no SD pill or detail block.

### WR-04: WARNING — Encoded Claude App class requests never receive log SD surfaces

**File:** `packages/ui/src/pages/home/components/network-logs.tsx:1540-1569`
**Issue:** Core deliberately decodes `anthropic/claude-ccr-h${hex}` and variant route ids in `parseClassRequest()` (`plan.ts:63-97`), including `[1m]`, and tests those routes. The UI helper only strips provider qualification and searches the remaining literal model string for class tokens. For an actual encoded-route swap, `requestedClass` is therefore undefined and no SD pill or detail block renders even though the response has a valid swap.

**Fix:** Decode the requested route using the existing `decodeClaudeAppGatewayRouteId()` before class matching, preserving `[1m]` handling, and then apply the class parser to the decoded value.

```ts
const decoded = decodeClaudeAppGatewayRouteId(value);
const model = stepDownRouteModelName(decoded ?? value);
```

Add UI fixtures for both `anthropic/claude-ccr-h${hex}` and `anthropic/claude-ccr7-h${hex}`, including `[1m]`, and require the same SD output as for `claude-opus-4-6`.

### WR-05: WARNING — Secret-bearing provider configuration crosses the notice boundary despite the scalar-only contract

**File:** `packages/core/src/class-switch/notice.ts:18-24,47-74`; `packages/core/src/routing/contracts.ts:6-11`; `packages/core/src/contracts/app.ts:176-203,272-284`
**Issue:** `recordStepDownSuccess()` receives a full `ProviderModelRef`. Its `provider` is the complete `GatewayProviderConfig`, including `api_key`/`apiKey`/`apikey` and credential secrets. The comment at `notice.ts:50-51` says provider keys never reach the notice, but those keys are present in the object passed into this module. They are not currently serialized into the notice, so this is a data-minimization and future-leak risk rather than a proven output disclosure.

**Fix:** Replace `target` in this API with a scalar DTO containing only the already-derived served class, model, provider display name, provider identity, credential slug, requested model, and requested-class-failure flag. Compute shelf and safeguards identity before crossing the notice boundary; do not pass the provider config object.

```ts
export type StepDownSuccessInput = {
  requestedModel?: string;
  servedClass: SwapNoticeClass;
  model: string;
  provider: string;
  providerIdentity?: string;
  credentialLabel?: string;
  hadRequestedClassFailure: boolean;
};
```

Add a test using a provider with distinctive secrets and verify that the notice function's public input contains no path by which a secret can be read.

## Info

### IN-01: INFO — `servedModel` is a dead, potentially divergent input

**File:** `packages/core/src/class-switch/notice.ts:20`; `packages/core/src/gateway/request/pipeline.ts:930`
**Issue:** `StepDownSuccessInput.servedModel` is supplied by the pipeline and by tests but never read. Notice generation instead uses `input.target.model`, while headers use `routedModel`. The extra input suggests an unimplemented consistency check and gives callers two model sources that can diverge.

**Fix:** Remove `servedModel` from `StepDownSuccessInput` and all call sites, or validate it deliberately against the served route if an independent assertion is needed. The scalar DTO in WR-05 should retain only the model values actually consumed.

---

_Reviewed: 2026-11-15T11:18:35Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: deep_

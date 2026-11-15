# Phase 3: Step-down - Pattern Map

**Mapped:** 2026-11-15  
**Files analyzed:** 19 (15 source/UI files and 4 test files; three test files are existing extension points, one is the recommended new core test)  
**Analogs found:** 19 / 19  
**Tracked-source gate:** All named existing analogs were checked with `git ls-files -- <path>`; all are tracked source files. The new `notice.ts` has no existing feature-equivalent analog.

This map derives the implementation scope from `03-CONTEXT.md`, `03-RESEARCH.md`, `FORK-SEAMS.md`, and `03-UI-SPEC.md`. It maps Phase 3 against the current codebase, not the prior phase maps. Parent gateway edits stay at the seam calls. Keep the response body model as Claude requested it, pass only scalar policy inputs, and do not add request-log fields.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/class-switch/plan.ts` | service | transform | same file | exact (in-place) |
| `packages/core/src/class-switch/seam.ts` | utility | request-response | same file | exact (in-place) |
| `packages/core/src/class-switch/notice.ts` | service | request-response + event-driven state | `packages/core/src/class-switch/bench.ts` | role-match (state module only) |
| `packages/core/src/gateway/request/pipeline.ts` | controller | request-response + streaming | same file | exact (in-place) |
| `packages/core/src/contracts/app.ts` | model | request-response | `RequestLogEntry` in the same file | role-match |
| `packages/core/src/contracts/ipc-channels.ts` | config | request-response | same file | exact (in-place) |
| `packages/core/src/web/management-server.ts` | controller | request-response | same file | exact (in-place) |
| `packages/electron/src/main/ipc.ts` | controller | request-response | same file | exact (in-place) |
| `packages/electron/src/main/preload.ts` | provider | request-response | same file | exact (in-place) |
| `packages/ui/src/types/electron.d.ts` | utility | request-response | same file | exact (in-place) |
| `packages/ui/src/web-client-bridge.ts` | provider | request-response | same file | exact (in-place) |
| `packages/ui/src/pages/home/App.tsx` | component | event-driven polling | same file | exact (in-place) |
| `packages/ui/src/pages/home/components/layout.tsx` | component | transform | `GatewayStartupErrorBanner` in the same file | role-match |
| `packages/ui/src/pages/home/components/network-logs.tsx` | component | transform | existing `LogRow`, `LogMobileCard`, and `LogExpandedDetails` in the same file | role-match |
| `packages/ui/src/pages/home/shared/i18n.tsx` | utility | transform | same file | exact (in-place) |
| `packages/core/test/unit/class-switch/step-down.test.mjs` | test | transform + request-response | `packages/core/test/unit/class-switch/choice.test.mjs`, `plan.test.mjs` | role-match (new test) |
| `packages/core/test/unit/web/web-management-server.test.mjs` | test | request-response | same file | exact (in-place) |
| `packages/ui/test/component/layout.test.tsx` | test | transform | same file | exact (in-place) |
| `packages/ui/test/component/observability.test.tsx` | test | transform | same file | exact (in-place) |

## Pattern Assignments

### `packages/core/src/class-switch/plan.ts` (service, transform)

**Analog:** This file; use `packages/core/src/class-switch/catalog.ts` for the authoritative shelf-class type and order.

**Imports pattern** (`plan.ts` lines 1-21):
```typescript
import { benchSortSignals, isBenched } from "@ccr/core/class-switch/bench";
import {
  readShelfSnapshot,
  type ShelfClass,
  type ShelfRow
} from "@ccr/core/class-switch/catalog";
import type { ProviderModelRef, RouteAttemptPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";
```

The class type is `"fable" | "opus" | "sonnet" | "haiku"` (`catalog.ts` line 26). Build one complete attempt array from the requested class through its lower classes, keeping requested-class rows first. For each shelf, reuse the existing filters, score order, token expansion, and indexes; do not return a lower row before all requested-class rows. Do not make a second policy call from a refusal loop.

**Existing per-shelf filter and ordering pattern** (`plan.ts` lines 379-399):
```typescript
  const rows = [...snapshot.shelves[parsed.shelfClass]]
    .filter((row) => rowPassesOneMillionFilter(row, parsed.requireOneMillion))
    .filter((row) => !isBenched(row.provider, row.model))
    .filter((row) => {
      const selector = `${row.provider}/${row.model}`;
      const target = modelRegistry?.resolve(selector);
      if (target?.kind !== "provider") {
        return false;
      }
      return (
        !rowFailsToolRequest(row, target, toolNames) &&
        !rowFailsImageRequest(row, target, hasImage) &&
        !rowFailsContext(row, estimatedTokens) &&
        hasLiveCredential(target.provider, row)
      );
    })
    .sort(compareShelfRows);

  const ordered = finalizeRowOrder(rows);
  const attempts = buildAttempts(ordered, modelRegistry);
  return attempts.length ? attempts : undefined;
```

The scalar-only input contract already exists in `AttemptsForClassScalars` (`plan.ts` lines 312-318). Preserve it: no message body, headers, or arbitrary request object crosses into class policy. Preserve the current empty-result behavior unless the new multi-class builder has exhausted every class.

### `packages/core/src/class-switch/seam.ts` (utility, request-response)

**Analog:** This file.

**Kill-switch and narrow export pattern** (`seam.ts` lines 184-205, 224-243):
```typescript
export function start(config: AppConfig): void {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  startClassSwitchCatalog(config, { loadConfig: loadAppConfig });
  startBench(config, { loadConfig: loadAppConfig });
}

export function stop(): void {
  stopClassSwitchCatalog();
  stopBench();
}

export { recordClassRefusal } from "@ccr/core/class-switch/bench";

export {
  liftToolResultImages,
  rememberedCredential,
  remember,
  requestFacts,
  setThinShareCounter
};
```

Keep the exact-string `CCR_CLASS_SWITCH === "0"` gate and expose only narrow class-switch methods from this seam to parent files. Add the notice lifecycle/read through this module rather than importing `notice.ts` directly from parent gateway files. Preserve the parent plan unchanged when the gate is off or the request does not name a class.

### `packages/core/src/class-switch/notice.ts` (service, request-response + event-driven state)

**Closest analog:** `packages/core/src/class-switch/bench.ts` (lines 22-47, 35-40) for module-scoped state and injectable/runtime options. There is no existing swap-notice record or clear-on-live-again implementation.

**State shape to copy only at the module-state level** (`bench.ts` lines 22-47):
```typescript
type BenchRow = {
  confirmed?: boolean;
  dueAt?: number;
  lastSuccessDurationMs?: number;
};

const benchRows = new Map<string, BenchRow>();
let benchLoaded = false;
let benchTimer: ReturnType<typeof setTimeout> | undefined;

export type ClassSwitchBenchOptions = {
  loadConfig?: () => Promise<AppConfig>;
  now?: () => number;
};
```

Use the UI contract's one-current-record shape: `{ requestedClass, servedClass, model, provider, credentialLabel, reason, sinceAt, safeguardsApplies }`. Record only an actual lower-class success; return `null` when there is no active swap. Clear/reconcile when the requested higher class has a live triple again. Do not retain raw credentials, message bodies, or request-log duplicates. The benchmark map is only a structural analogy; its persistence, timers, and probe behavior are not part of the notice.

**No exact code excerpt exists** for notice lifecycle, class-liveness reconciliation, concurrent replacement policy, or safeguards applicability. Use `03-RESEARCH.md` and `03-UI-SPEC.md`; do not copy bench persistence or polling into this file.

### `packages/core/src/gateway/request/pipeline.ts` (controller, request-response + streaming)

**Analog:** This file. Keep the existing client-visible model rewrite; add the two headers only after the final served route is known and only for a real step-down.

**Imports and existing class-switch seam** (`pipeline.ts` lines 29-33):
```typescript
import { reserveApiKeyLimits } from "@ccr/core/gateway/auth/api-key-authorizer";
import { isClassAttempt } from "@ccr/core/class-switch/seam";
import { recordProviderCredentialOutcome } from "@ccr/core/providers/credential-pool";
```

**Requested model, selected route, response headers** (`pipeline.ts` lines 827-858):
```typescript
const clientVisibleResponseModel = requestedModel ?? routedModel;
bodyToForward = upstreamResult.attempt.body ?? bodyToForward;
routedModel = upstreamResult.attempt.model ?? routedModel;
// ...
const responseHeaders = rewriteCapabilityResponseHeaders(
  new Headers(mergeFallbackResponseHeaders(upstreamResponseHeaders(upstreamResult), upstreamResult)),
  this.config
);
pluginResponseHeaders.forEach((value, name) => responseHeaders.set(name, value));
```

**Identity-preserving body rewrite** (`pipeline.ts` lines 1032-1034):
```typescript
const clientResponseBody = rewriteAnthropicResponseModel && clientVisibleResponseModel
  ? rewriteAnthropicMessageStartModelStream(responseBody, clientVisibleResponseModel)
  : responseBody;
```

Use the response-header collection above to set `x-ccr-requested-model` and `x-ccr-served-model` together when a lower class actually serves. Keep the body model tied to `clientVisibleResponseModel`; do not rewrite it to the lower provider route. Do not introduce a request-log schema or add headers to non-step-down responses.

### `packages/core/src/contracts/app.ts` (model, request-response)

**Analog:** Existing public types in this file, especially `RequestLogEntry` (`app.ts` lines 2229-2277).

Keep the notice data contract in the shared core contracts where Electron and UI can type it. Use known `ShelfClass` values for its class fields and strings for safe display values. The existing request-log contract already has `requestedModel`, `resolvedModel`, `responseModel`, `provider`, `credentialId`, `responseHeaders`, and `routeTrace` (lines 2237-2268); do not add step-down columns.

**Existing request-log fields excerpt** (`app.ts` lines 2253-2268):
```typescript
provider: string;
reasoningTokens: number;
responseHeadersMs?: number;
requestedModel?: string;
requestBody: RequestLogBody;
requestHeaders: Record<string, string | string[]>;
requestId: string;
routeAttemptCount: number;
routeHopCount: number;
routeTrace?: RequestRouteTrace;
routeTraceTruncated: boolean;
retryAttempts: RequestLogRetryAttempt[];
resolvedModel?: string;
responseBody?: RequestLogBody;
responseModel?: string;
responseHeaders: Record<string, string | string[]>;
```

### `packages/core/src/contracts/ipc-channels.ts`, `packages/electron/src/main/ipc.ts`, `packages/electron/src/main/preload.ts`, `packages/ui/src/types/electron.d.ts`, and `packages/ui/src/web-client-bridge.ts` (typed request-response bridge)

**Analogs:** Each file's existing `getRequestLogs` or `getGatewayStatus` method. Keep one read-only API consistent across every desktop and web surface.

**Channel constant** (`ipc-channels.ts` lines 10, 24-26):
```typescript
appGetGatewayStatus: "ccr:app:get-gateway-status",
appGetRequestLogDetail: "ccr:app:get-request-log-detail",
appGetRequestLogBodyChunk: "ccr:app:get-request-log-body-chunk",
appGetRequestLogs: "ccr:app:get-request-logs",
```

**Electron handler** (`ipc.ts` lines 121-128):
```typescript
ipcMain.handle(IPC_CHANNELS.appGetGatewayStatus, () => gatewayService.getStatus());
ipcMain.handle(IPC_CHANNELS.appGetRequestLogDetail, (_event, request) => getRequestLogDetail(request));
ipcMain.handle(IPC_CHANNELS.appGetRequestLogBodyChunk, (_event, request) => getRequestLogBodyChunk(request));
ipcMain.handle(IPC_CHANNELS.appGetRequestLogs, (_event, filter?: RequestLogListFilter) => getRequestLogs(filter));
```

**Preload** (`preload.ts` lines 123-139):
```typescript
getGatewayStatus: () => invoke(IPC_CHANNELS.appGetGatewayStatus) as Promise<GatewayStatus>,
getRequestLogDetail: (request: RequestLogDetailRequest) => invoke(IPC_CHANNELS.appGetRequestLogDetail, request) as Promise<RequestLogEntry | undefined>,
getRequestLogBodyChunk: (request: RequestLogBodyChunkRequest) => invoke(IPC_CHANNELS.appGetRequestLogBodyChunk, request) as Promise<RequestLogBodyChunk | undefined>,
getRequestLogs: (filter?: RequestLogListFilter) => invoke(IPC_CHANNELS.appGetRequestLogs, filter) as Promise<RequestLogPage>,
```

**Window type and authenticated web bridge** (`types/electron.d.ts` lines 111, 125-127; `web-client-bridge.ts` lines 13-36, 107-140):
```typescript
getGatewayStatus: () => Promise<GatewayStatus>;
getRequestLogDetail: (request: RequestLogDetailRequest) => Promise<RequestLogEntry | undefined>;
getRequestLogBodyChunk: (request: RequestLogBodyChunkRequest) => Promise<RequestLogBodyChunk | undefined>;
getRequestLogs: (filter?: RequestLogListFilter) => Promise<RequestLogPage>;
```

```typescript
async function rpc(method: string, args: unknown[] = []): Promise<unknown> {
  const response = await fetch(rpcEndpoint, {
    body: JSON.stringify({ args: trimTrailingUndefined(args), method }),
    headers: {
      "content-type": "application/json",
      ...(webAuthToken ? { [webAuthHeader]: webAuthToken } : {})
    },
    method: "POST"
  });
  // ...
}
```

Add the same typed zero-argument `getSwapNotice` read in the desktop channel/handler/preload/types and the web bridge. Do not create an unauthenticated HTTP route or a write API.

### `packages/core/src/web/management-server.ts` (controller, request-response)

**Analog:** This file's `rpcHandlers` map and request authentication.

**RPC authentication/error path** (`management-server.ts` lines 219-253):
```typescript
if (!hasValidWebAuthToken(request, security)) {
  sendJson(response, 401, { error: { message: "CCR web authentication token is missing or invalid." }, ok: false });
  return;
}
// ...
const method = typeof payload.method === "string" ? payload.method.trim() : "";
const handler = rpcHandlers[method];
if (!method || !handler) {
  sendJson(response, 404, { error: { message: `Unknown CCR web RPC method: ${method || "(empty)"}` }, ok: false });
  return;
}
try {
  const value = await handler(...(Array.isArray(payload.args) ? payload.args : []));
  sendJson(response, 200, { ok: true, value });
} catch (error) {
  sendJson(response, error instanceof Error && error.name === "AppConfigConflictError" ? 409 : 500,
    { error: { message: formatError(error) }, ok: false });
}
```

Add `getSwapNotice` as a read-only entry in the existing `rpcHandlers` map (lines 266-345), following the existing zero-argument reads such as `getGatewayStatus`. Keep the existing RPC authentication and response/error envelope.

### `packages/ui/src/pages/home/App.tsx` (component, event-driven polling)

**Analog:** This file's `refreshRuntimeStatus` poll.

**State refresh and nonfatal parallel reads** (`App.tsx` lines 366-384):
```typescript
const refreshRuntimeStatus = async () => {
  const ccr = window.ccr;
  if (!ccr) {
    return;
  }
  await Promise.allSettled([
    ccr.getGatewayStatus().then((next) => {
      setGatewayStatus((current) => preserveEqualPollingSnapshot(current, next));
      setRuntimeDisconnected(false);
    }).catch(() => {
      setRuntimeDisconnected(true);
    }),
    ccr.getProxyStatus().then((next) => {
      setProxyStatus((current) => preserveEqualPollingSnapshot(current, next));
    }),
    refreshProfileRuntimeStatus()
  ]);
};
const stopPolling = startVisiblePolling(refreshRuntimeStatus, 2000);
```

Add notice state to this existing poll; preserve equality snapshots and make a rejected/absent bridge read nonfatal. Do not add a timer. Pass the notice into `MainLayout` at its existing call site (`App.tsx` lines 3227-3253).

### `packages/ui/src/pages/home/components/layout.tsx` (component, transform)

**Analog:** `GatewayStartupErrorBanner` and its `MainLayout` mount point.

**Existing mount geometry** (`layout.tsx` lines 279-284):
```tsx
<GatewayStartupErrorBanner
  className="mx-5 mt-3 max-[720px]:mx-3"
  message={gatewayStartupError}
  onOpenServerSettings={onOpenServerSettings}
/>
<div
  className={cn(
    "min-h-0 flex-1 px-5 pb-5 pt-5 max-[720px]:px-3 max-[720px]:pb-3 max-[720px]:pt-3",
```

**Existing banner accessibility and render pattern** (`layout.tsx` lines 392-420):
```tsx
export function GatewayStartupErrorBanner({ className, message, onOpenServerSettings }: {
  className?: string;
  message?: string;
  onOpenServerSettings?: () => void;
}) {
  const t = useAppText();
  const detail = message?.trim();
  if (!detail) {
    return null;
  }

  return (
    <div
      aria-live="assertive"
      className={cn(
        "app-no-drag flex min-w-0 items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive",
        className
      )}
      role="alert"
    >
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
```

Use the existing geometry/mount rhythm, but apply the approved `network-body-warning` token surface and polite `role="status"`/ `aria-live="polite"` semantics, not the error banner's assertive/destructive treatment. Render nothing for `null`; no close action.

### `packages/ui/src/pages/home/components/network-logs.tsx` (component, transform)

**Analog:** Existing desktop/mobile request-row pills and the expanded request detail block.

**Retry pill in both row variants** (`network-logs.tsx` lines 840-844, 927-934):
```tsx
{item.retryAttempts.length > 0 ? (
  <span className="network-service-paused rounded px-1.5 py-0.5 text-[10px] font-bold">
    R{item.retryAttempts.length}
  </span>
) : null}
```

```tsx
{item.retryAttempts.length > 0 ? (
  <span
    className="network-service-paused shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
    title={`${t("Retry attempts")}: ${item.retryAttempts.length}`}
  >
    R{item.retryAttempts.length}
  </span>
) : null}
```

Add the noninteractive `SD` pill beside this pattern in both `LogMobileCard` and `LogRow`. Derive it from existing requested vs. resolved/response model values; require both class labels and do not extend `RequestLogEntry`.

**Expanded details and existing response header display** (`network-logs.tsx` lines 973-1003, 1009-1020):
```tsx
<div className={cn("network-body-meta grid grid-cols-2 gap-y-2 border-b px-3 py-2 text-[12px] sm:grid-cols-4", hasCredentialInfo ? "lg:grid-cols-12" : "lg:grid-cols-9")}>
  <LogMetric label={t("持续时间")} value={formatDuration(entry.durationMs)} />
  <LogMetric label={t("Provider")} value={entry.provider || "-"} />
  <LogMetric label={t("Model")} value={entry.model || "-"} />
  {entry.credentialId ? <LogMetric label={t("Credential")} value={entry.credentialId} /> : null}
</div>
{entry.retryAttempts.length > 0 ? <LogRetryAttempts attempts={entry.retryAttempts} /> : null}
{entry.routeTrace ? <LogRouteTrace trace={entry.routeTrace} /> : null}
```

```tsx
<LogJsonPanel
  body={entry.responseBody}
  headerEmptyLabel="No response headers"
  headers={entry.responseHeaders}
  requestLogId={entry.id}
  side="response"
  subtitle={`HTTP ${entry.statusCode || "-"}`}
  title={t("响应")}
/>
```

Place step-down details above the existing metric grid, use `LogMetric`-style label/value pairs and the existing `routeTrace` decision reason when present. Leave response headers in the current panel; the two new backend headers appear there without a UI header table change. Never display a credential secret.

### `packages/ui/src/pages/home/shared/i18n.tsx` (utility, transform)

**Analog:** The existing `AppCopy` contract and `appCopy` language maps (`i18n.tsx` lines 103-124).

```typescript
text: Record<string, string>;
};

export const appCopy: Record<ResolvedLanguage, AppCopy> = {
  en: {
    navigation: {
      onboarding: "Onboarding",
      "api-keys": "API Keys",
      extensions: "Extensions",
      logs: "Logs",
```

Put all new visible copy in the established English source and Chinese translation maps. Components should call `useAppText()`/ `t()`; do not hard-code new user-facing copy in JSX.

### `packages/core/test/unit/class-switch/step-down.test.mjs` (test, transform + request-response)

**Analog:** `packages/core/test/unit/class-switch/choice.test.mjs` for current class-switch/executor integration-style fixtures and `plan.test.mjs` for a compact class plan and temporary shelf directory.

**Test imports and fixtures** (`plan.test.mjs` lines 1-8, 24-49):
```javascript
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { classifyModel, shelfSnapshotPath, writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";
```

```javascript
function classPlan(bodyModel, registry, overrides = {}) {
  return createRouteExecutionPlan({
    bodyModel,
    fallback: { mode: "off", models: [], retryCount: 0 },
    hasRequestBody: true,
    modelRegistry: registry,
    primaryModel: bodyModel,
    ...overrides
  });
}
```

Use `node:test`, `node:assert/strict`, flat `test()` calls, `.ts` source imports, and temporary shelf data restored in `finally`. Cover requested-class priority, each lower-class transition, all-class exhaustion, disabled gate, response identity, both headers together, notice create/replace/clear, and secret non-disclosure. Stub the executor/provider path; no live upstream call.

### `packages/core/test/unit/web/web-management-server.test.mjs` (test, request-response)

**Analog:** Its authenticated RPC test (`web-management-server.test.mjs` lines 38-67).

```javascript
test("web RPC ignores Origin and Referer when the auth token is valid", async () => {
  const { startWebManagementServer } = await import("@ccr/core/web/management-server.ts");
  const authToken = "test-web-auth-token";
  const runtime = await startWebManagementServer({
    authToken,
    host: "127.0.0.1",
    port: 0,
    startGateway: false
  });
  try {
    const endpoint = new URL("/api/ccr/rpc", runtime.url);
    const response = await fetch(endpoint, {
      body: JSON.stringify({ args: [], method: "getAppInfo" }),
      headers: { "content-type": "application/json", "x-ccr-web-auth": authToken },
      method: "POST"
    });
```

Follow this test's real local management server and authenticated RPC call to verify `getSwapNotice` returns the current notice (and preserves the standard RPC envelope). Keep the auth boundary unchanged.

### `packages/ui/test/component/layout.test.tsx` and `packages/ui/test/component/observability.test.tsx` (tests, transform)

**Analogs:** Existing static-render tests in each file.

**Banner test pattern** (`layout.test.tsx` lines 1-12, 70-88):
```tsx
import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GatewayStartupErrorBanner, groupSidebarNavigation, MainLayout, UpdateEntryButton } from "@ccr/ui/pages/home/components/layout.tsx";
import { AppI18nContext, appCopy } from "@ccr/ui/pages/home/shared/i18n.tsx";
```

```tsx
test("GatewayStartupErrorBanner stays hidden without a failure message", () => {
  const html = renderToStaticMarkup(<GatewayStartupErrorBanner message="" />);

  assert.equal(html, "");
});
```

Test notice absent/present, polite status semantics, safeguards line conditional on non-Anthropic, and credential label rendering without a raw key. Use `renderToStaticMarkup` and the `AppI18nContext` fixture.

**Request-log fixture pattern** (`observability.test.tsx` lines 1-9, 25-56):
```tsx
import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { RequestLogEntry, RequestLogPage } from "@ccr/core/contracts/app.ts";
import { LogsView } from "@ccr/ui/pages/home/components/network-logs.tsx";
import { AppI18nContext, appCopy } from "@ccr/ui/pages/home/shared/i18n.tsx";
```

```tsx
const sampleRequestLogEntry: RequestLogEntry = {
  client: "claude-code",
  model: "claude-sonnet-4",
  requestedModel: undefined,
  provider: "anthropic",
  requestHeaders: {},
  responseHeaders: {},
  retryAttempts: [],
  statusCode: 200,
  url: "/v1/messages"
};
```

Extend the existing valid fixture with already-supported requested/resolved/response model fields and optional `routeTrace`. Test the `SD` pill in desktop and mobile rows, the expanded detail block, and no markup on non-step-down entries. Do not add fields to the schema just for tests.

## Shared Patterns

### Class order, filters, and gate
**Sources:** `packages/core/src/class-switch/catalog.ts` line 26; `packages/core/src/class-switch/plan.ts` lines 356-399; `packages/core/src/class-switch/seam.ts` lines 224-243  
**Apply to:** `plan.ts`, `seam.ts`, `notice.ts`, core tests

Use the requested shelf first, then the lower classes in the catalog's defined order. Preserve current eligibility and ordering per shelf; the existing executor consumes one ordered attempt list. Keep policy input scalars-only and preserve the `CCR_CLASS_SWITCH=0` behavior.

### Response identity and headers
**Source:** `packages/core/src/gateway/request/pipeline.ts` lines 827-858, 1032-1034  
**Apply to:** `pipeline.ts`, core tests

The response body uses `clientVisibleResponseModel`; the actual served route is separate. Set the requested/served headers together only when a lower class actually serves. Do not change parent stream rewriting or request-log shape.

### Read-only notice transport and auth
**Sources:** `packages/core/src/web/management-server.ts` lines 219-253, 266-345; `packages/electron/src/main/ipc.ts` lines 121-128; `packages/electron/src/main/preload.ts` lines 123-139; `packages/ui/src/web-client-bridge.ts` lines 13-36, 107-140  
**Apply to:** the contracts, IPC, preload, web RPC, and App call

Expose one typed read through existing desktop IPC and authenticated management RPC. Keep method names consistent across both bridges. No new route, no write operation, no API key or message-body exposure. A failed UI read is nonfatal and produces no banner.

### UI state and request-log data
**Sources:** `packages/ui/src/pages/home/App.tsx` lines 366-384; `packages/ui/src/pages/home/components/layout.tsx` lines 279-284, 392-420; `packages/ui/src/pages/home/components/network-logs.tsx` lines 927-1003  
**Apply to:** App poll, banner, log pill/details, UI tests

Reuse the 2-second visible runtime poll and equality-preserving state update. Use the warning token classes, `t()` translations, existing retry-pill geometry, existing `LogMetric` layout, and request-log fields already in `RequestLogEntry`. Avoid a new timer, page, warning color, log schema, or API key display.

## No Exact Analog

| Behavior | Closest Existing Code | Why it is not an exact analog |
|----------|-----------------------|------------------------------|
| One active swap notice, live-again clearing, and safeguards applicability | `packages/core/src/class-switch/bench.ts` lines 22-47 | The bench is module-scoped state, but it has no current swap notice or class-liveness reconciliation. Use `03-RESEARCH.md` and `03-UI-SPEC.md` for that behavior. |
| Cross-class ordered attempt list | `packages/core/src/class-switch/plan.ts` lines 356-399 | Current code builds one class's filtered list. Extend this list builder; do not copy a second executor loop or a second policy invocation. |

## Metadata

**Analog search scope:** `packages/core/src/class-switch/`, routing/request pipeline, shared contracts, management RPC, Electron IPC/preload, home UI bridge/components, and core/UI tests.  
**Files scanned:** Existing class-switch planner/seam/bench/catalog; pipeline; RPC and bridge surfaces; UI poll/banner/request-log components; associated test fixtures.  
**Pattern extraction date:** 2026-11-15.
import { startBench, stopBench } from "@ccr/core/class-switch/bench";
import {
  contextWindowForProviderModel,
  readShelfSnapshot,
  startClassSwitchCatalog,
  stopClassSwitchCatalog
} from "@ccr/core/class-switch/catalog";
import { clearSwapNotice, recordStepDownSuccess } from "@ccr/core/class-switch/notice";
import { providerIdentityName } from "@ccr/core/class-switch/provider-identity";
import {
  shelfClassForTarget
} from "@ccr/core/class-switch/plan";
import { loadAppConfig } from "@ccr/core/config/config";
import type { RouteTraceObserver } from "@ccr/core/observability/route-trace";
import {
  attemptsForStepDown,
  liftToolResultImages,
  parseClassRequest,
  rememberedCredential,
  remember,
  requestFacts,
  setThinShareCounter
} from "@ccr/core/class-switch/plan";
import {
  decodeClaudeAppGatewayRouteId,
  stripClaudeAppGatewayOneMillionContextSuffix
} from "@ccr/core/agents/claude-app/gateway-routes";
import type {
  AppConfig,
  GatewayProviderConfig,
  ProviderModelMetadata,
  RouterFallbackConfig,
  SwapNotice
} from "@ccr/core/contracts/app";
import type { RouteModelRef } from "@ccr/core/routing/contracts";
import {
  findModelCatalogEntry,
  findProviderModelCatalogEntry,
  modelCatalogMaxInputTokens
} from "@ccr/core/gateway/model-catalog";
import type { RouteExecutionPlan } from "@ccr/core/routing/contracts";
import { modelRegistryForConfig, type ModelRegistry } from "@ccr/core/routing/model-registry";

export type RouteExecutionPlanInput = {
  bodyModel?: string;
  estimatedTokens?: number;
  fallback: RouterFallbackConfig;
  hasImage?: boolean;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
  sessionId?: string;
  toolNames?: string[];
  toolTurn?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function providerModelMetadata(
  provider: GatewayProviderConfig,
  model: string
): ProviderModelMetadata | undefined {
  const metadata = provider.modelMetadata ?? {};
  const direct = metadata[model];
  if (direct) {
    return direct;
  }
  const normalized = model.trim().toLowerCase();
  return Object.entries(metadata).find(([name]) => name.trim().toLowerCase() === normalized)?.[1];
}

function snapshotContextWindow(providerName: string, model: string): number | undefined {
  const snapshot = readShelfSnapshot();
  if (!snapshot) {
    return undefined;
  }
  const rows = [
    ...snapshot.shelves.fable,
    ...snapshot.shelves.haiku,
    ...snapshot.shelves.opus,
    ...snapshot.shelves.sonnet,
    ...snapshot.excluded,
    ...snapshot.review
  ];
  const match = rows.find((row) => row.provider === providerName && row.model === model);
  const value = match?.contextWindow;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

function selectorsForGatewayRow(rowId: string): string[] {
  const selectors = new Set<string>();
  const add = (value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      selectors.add(trimmed);
    }
  };
  add(rowId);
  add(stripClaudeAppGatewayOneMillionContextSuffix(rowId));
  const decoded = decodeClaudeAppGatewayRouteId(rowId);
  if (decoded) {
    add(decoded);
    add(stripClaudeAppGatewayOneMillionContextSuffix(decoded));
  }
  return [...selectors];
}

function catalogMaxForResolved(selectors: string[], provider: GatewayProviderConfig, model: string): number | undefined {
  const entry =
    findProviderModelCatalogEntry(provider, model, selectors) ?? selectors.map((selector) => findModelCatalogEntry(selector)).find(Boolean);
  const max = modelCatalogMaxInputTokens(entry);
  return max > 0 ? max : undefined;
}

function applyWindowFields(row: Record<string, unknown>, window: number): void {
  row.context_window = window;
  row.max_context_window = window;
  if ("max_input_tokens" in row) {
    row.max_input_tokens = window;
  }
  const capabilities = row.capabilities;
  if (!isRecord(capabilities)) {
    return;
  }
  const contextWindow = capabilities.context_window;
  if (isRecord(contextWindow)) {
    contextWindow.max_input_tokens = window;
    contextWindow.supported = window > 0;
    contextWindow.supports_1m_context = window >= 1_000_000;
  }
  const contextManagement = capabilities.context_management;
  if (isRecord(contextManagement)) {
    contextManagement.max_input_tokens = window;
    contextManagement.supported = window > 0;
    contextManagement.supports_1m_context = window >= 1_000_000;
  }
}

export function applyContextWindows(
  response: Record<string, unknown>,
  config: AppConfig
): Record<string, unknown> {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return response;
  }
  const data = response.data;
  if (!Array.isArray(data)) {
    return response;
  }
  const registry = modelRegistryForConfig(config);
  for (const item of data) {
    if (!isRecord(item) || typeof item.id !== "string") {
      continue;
    }
    const selectors = selectorsForGatewayRow(item.id);
    let resolved: { model: string; provider: GatewayProviderConfig } | undefined;
    for (const selector of selectors) {
      resolved = registry.resolveProviderModel(selector);
      if (resolved) {
        break;
      }
    }
    if (!resolved) {
      continue;
    }
    const providerName = resolved.provider.name?.trim() ?? "";
    const metadata = providerModelMetadata(resolved.provider, resolved.model);
    const catalogMax = catalogMaxForResolved(selectors, resolved.provider, resolved.model);
    const hasMetadataWindow = Boolean(
      (typeof metadata?.contextWindow === "number" && metadata.contextWindow > 0) ||
        (typeof metadata?.maxContextWindow === "number" && metadata.maxContextWindow > 0)
    );
    const openRouterLength =
      hasMetadataWindow || catalogMax
        ? undefined
        : snapshotContextWindow(providerName, resolved.model);
    const window = contextWindowForProviderModel({
      metadata,
      catalogMaxInputTokens: catalogMax,
      openRouterContextLength: openRouterLength
    });
    if (!window) {
      continue;
    }
    applyWindowFields(item, window);
  }
  return response;
}

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
  clearSwapNotice();
}

export { recordClassRefusal } from "@ccr/core/class-switch/bench";

// RED phase: the parent-facing notice seam. notice.ts holds compiling stubs
// until the GREEN task implements the record and the live-again reconciliation.
export {
  clearSwapNotice,
  readSwapNotice as getSwapNotice,
  recordStepDownSuccess
} from "@ccr/core/class-switch/notice";

// The pipeline's seam entry: it carries the route target object in process
// memory, then derives every notice scalar (served shelf class from the
// planner's snapshot mapping, model, provider display name, and the provider's
// Anthropic identity) before calling the notice boundary. Provider config
// objects and their credential secrets never cross into the notice input.
//
// The optional trace observer captures the real swap reason for the request
// log: only a non-null notice from an actual lower-class success emits exactly
// one explicitly marked class-switch decision whose reason is the notice's own
// fixed reason. Null-notice paths (same-class, non-class, exhausted) capture
// nothing, and the reason is copied from the notice — never recalculated and
// never taken from provider errors, bodies, or credentials.
export function recordStepDownSuccessFromTarget(input: {
  credentialLabel?: string;
  hadRequestedClassFailure: boolean;
  requestedModel?: string;
  target: RouteModelRef | undefined;
  trace?: RouteTraceObserver;
}): SwapNotice | null {
  if (input.target?.kind !== "provider") {
    return null;
  }
  const servedClass = shelfClassForTarget(input.target);
  if (!servedClass) {
    return null;
  }
  const notice = recordStepDownSuccess({
    credentialLabel: input.credentialLabel,
    hadRequestedClassFailure: input.hadRequestedClassFailure,
    model: input.target.model,
    provider: input.target.provider.name ?? "",
    providerIdentity: providerIdentityName(input.target.provider),
    requestedModel: input.requestedModel,
    servedClass
  });
  if (notice) {
    input.trace?.capture({
      decision: { reason: notice.reason, source: "class-switch" },
      kind: "decision",
      name: "class-switch.step-down",
      phase: "routing",
      status: "ok"
    });
  }
  return notice;
}

export { hasRequestedClassFailure } from "@ccr/core/class-switch/plan";

export {
  liftToolResultImages,
  rememberedCredential,
  remember,
  requestFacts,
  setThinShareCounter
};

const classAttempts = new WeakSet<object>();

export function markClassAttempt(attempt: object): void {
  classAttempts.add(attempt);
}

export function isClassAttempt(attempt: object | undefined): boolean {
  return attempt !== undefined && classAttempts.has(attempt);
}

export function classShelfActive(modelName: string | undefined): boolean {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return false;
  }
  return Boolean(parseClassRequest(modelName));
}

export function applyShelf(plan: RouteExecutionPlan, input: RouteExecutionPlanInput): RouteExecutionPlan {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return plan;
  }
  const parsed = parseClassRequest(input.bodyModel ?? input.primaryModel);
  if (!parsed) {
    return plan;
  }
  const attempts = attemptsForStepDown(parsed, input.modelRegistry, {
    estimatedTokens: input.estimatedTokens ?? 0,
    hasImage: input.hasImage ?? false,
    sessionId: input.sessionId,
    toolNames: input.toolNames ?? [],
    toolTurn: input.toolTurn ?? false
  });
  if (!attempts) {
    // Every eligible class is exhausted: the parent executor's existing
    // empty-list UpstreamRequestError is the terminal error. No parent
    // model-chain or unrelated provider route may serve instead.
    return { ...plan, attempts: [] };
  }
  return { ...plan, attempts };
}
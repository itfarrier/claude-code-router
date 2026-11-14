import {
  contextWindowForProviderModel,
  readShelfSnapshot,
  startClassSwitchCatalog,
  stopClassSwitchCatalog
} from "@ccr/core/class-switch/catalog";
import { attemptsForClass, parseClassRequest } from "@ccr/core/class-switch/plan";
import {
  decodeClaudeAppGatewayRouteId,
  stripClaudeAppGatewayOneMillionContextSuffix
} from "@ccr/core/agents/claude-app/gateway-routes";
import type {
  AppConfig,
  GatewayProviderConfig,
  ProviderModelMetadata,
  RouterFallbackConfig
} from "@ccr/core/contracts/app";
import {
  findModelCatalogEntry,
  findProviderModelCatalogEntry,
  modelCatalogMaxInputTokens
} from "@ccr/core/gateway/model-catalog";
import type { RouteExecutionPlan } from "@ccr/core/routing/contracts";
import { modelRegistryForConfig, type ModelRegistry } from "@ccr/core/routing/model-registry";

export type RouteExecutionPlanInput = {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
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
  }
  const contextManagement = capabilities.context_management;
  if (isRecord(contextManagement)) {
    contextManagement.max_input_tokens = window;
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
  startClassSwitchCatalog(config);
}

export function stop(): void {
  stopClassSwitchCatalog();
}

export function applyShelf(plan: RouteExecutionPlan, input: RouteExecutionPlanInput): RouteExecutionPlan {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return plan;
  }
  const parsed = parseClassRequest(input.bodyModel ?? input.primaryModel);
  if (!parsed) {
    return plan;
  }
  const attempts = attemptsForClass(parsed, input.modelRegistry);
  if (!attempts) {
    return plan;
  }
  return { ...plan, attempts };
}
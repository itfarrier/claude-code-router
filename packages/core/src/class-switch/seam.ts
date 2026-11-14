import { attemptsForClass, parseClassRequest } from "@ccr/core/class-switch/plan";
import type { AppConfig, RouterFallbackConfig } from "@ccr/core/contracts/app";
import type { RouteExecutionPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";

export type RouteExecutionPlanInput = {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
};

export function applyContextWindows(
  response: Record<string, unknown>,
  _config: AppConfig
): Record<string, unknown> {
  return response;
}

export function start(_config: AppConfig): void {}

export function stop(): void {}

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
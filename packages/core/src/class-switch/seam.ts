import type { RouterFallbackConfig } from "@ccr/core/contracts/app";
import type { RouteExecutionPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";

export type RouteExecutionPlanInput = {
  bodyModel?: string;
  fallback: RouterFallbackConfig;
  hasRequestBody: boolean;
  modelRegistry?: ModelRegistry;
  primaryModel?: string;
};

export function applyShelf(plan: RouteExecutionPlan, _input: RouteExecutionPlanInput): RouteExecutionPlan {
  return plan;
}
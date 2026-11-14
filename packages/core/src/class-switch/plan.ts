import type { ShelfClass } from "@ccr/core/class-switch/catalog";
import type { RouteAttemptPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";

export type ParsedClassRequest = {
  shelfClass: ShelfClass;
  requireOneMillion: boolean;
};

export function parseClassRequest(_modelName: string | undefined): ParsedClassRequest | undefined {
  return undefined;
}

export function attemptsForClass(
  _parsed: ParsedClassRequest,
  _modelRegistry: ModelRegistry | undefined
): RouteAttemptPlan[] | undefined {
  return undefined;
}
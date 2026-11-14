import { readShelfSnapshot, type ShelfClass } from "@ccr/core/class-switch/catalog";
import type { RouteAttemptPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";

export type ParsedClassRequest = {
  shelfClass: ShelfClass;
  requireOneMillion: boolean;
};

function isAsciiAlnum(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function parseClassRequest(modelName: string | undefined): ParsedClassRequest | undefined {
  const trimmed = modelName?.trim();
  if (!trimmed) {
    return undefined;
  }
  const lower = trimmed.toLowerCase();
  const prefix = "claude-opus";
  if (!lower.startsWith(prefix)) {
    return undefined;
  }
  const suffix = lower.slice(prefix.length);
  if (suffix.length > 0 && isAsciiAlnum(suffix[0]!)) {
    return undefined;
  }
  return { requireOneMillion: false, shelfClass: "opus" };
}

export function attemptsForClass(
  parsed: ParsedClassRequest,
  modelRegistry: ModelRegistry | undefined
): RouteAttemptPlan[] | undefined {
  const snapshot = readShelfSnapshot();
  if (!snapshot) {
    return undefined;
  }
  const rows = snapshot.shelves[parsed.shelfClass];
  const attempts: RouteAttemptPlan[] = [];
  for (const row of rows) {
    const selector = `${row.provider}/${row.model}`;
    const target = modelRegistry?.resolve(selector);
    if (target?.kind !== "provider") {
      continue;
    }
    attempts.push({
      index: attempts.length,
      model: selector,
      target
    });
  }
  return attempts.length ? attempts : undefined;
}
import { isBenched } from "@ccr/core/class-switch/bench";
import {
  readShelfSnapshot,
  type ShelfClass,
  type ShelfRow
} from "@ccr/core/class-switch/catalog";
import {
  decodeClaudeAppGatewayRouteId,
  stripClaudeAppGatewayOneMillionContextSuffix
} from "@ccr/core/agents/claude-app/gateway-routes";
import type { RouteAttemptPlan } from "@ccr/core/routing/contracts";
import type { ModelRegistry } from "@ccr/core/routing/model-registry";

export type ParsedClassRequest = {
  shelfClass: ShelfClass;
  requireOneMillion: boolean;
};

const CLASS_PREFIXES: Array<{ prefix: string; shelfClass: ShelfClass }> = [
  { prefix: "claude-fable", shelfClass: "fable" },
  { prefix: "claude-opus", shelfClass: "opus" },
  { prefix: "claude-sonnet", shelfClass: "sonnet" },
  { prefix: "claude-haiku", shelfClass: "haiku" }
];

const SHORT_CLASS_NAMES: Record<string, ShelfClass> = {
  fable: "fable",
  haiku: "haiku",
  opus: "opus",
  sonnet: "sonnet"
};

function isAsciiAlnum(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function matchesClassPrefix(name: string, prefix: string): boolean {
  if (!name.startsWith(prefix)) {
    return false;
  }
  const suffix = name.slice(prefix.length);
  return !(suffix.length > 0 && isAsciiAlnum(suffix[0]!));
}

function hasOneMillionSuffix(name: string): boolean {
  return /\[1m\]$/i.test(name);
}

export function parseClassRequest(modelName: string | undefined): ParsedClassRequest | undefined {
  let name = modelName?.trim();
  if (!name) {
    return undefined;
  }
  let requireOneMillion = hasOneMillionSuffix(name);
  const decoded = decodeClaudeAppGatewayRouteId(name);
  if (decoded) {
    name = decoded;
  }
  if (hasOneMillionSuffix(name)) {
    requireOneMillion = true;
    name = stripClaudeAppGatewayOneMillionContextSuffix(name);
  } else if (!decoded) {
    name = stripClaudeAppGatewayOneMillionContextSuffix(name);
  }
  if (name.includes("/")) {
    return undefined;
  }
  const lower = name.toLowerCase();
  if (lower === "best") {
    return { requireOneMillion, shelfClass: "opus" };
  }
  for (const { prefix, shelfClass } of CLASS_PREFIXES) {
    if (matchesClassPrefix(lower, prefix)) {
      return { requireOneMillion, shelfClass };
    }
  }
  if (requireOneMillion) {
    const shortClass = SHORT_CLASS_NAMES[lower];
    if (shortClass) {
      return { requireOneMillion: true, shelfClass: shortClass };
    }
  }
  return undefined;
}

function compareShelfRows(left: ShelfRow, right: ShelfRow): number {
  const leftScored = typeof left.score === "number" && Number.isFinite(left.score);
  const rightScored = typeof right.score === "number" && Number.isFinite(right.score);
  if (leftScored !== rightScored) {
    return leftScored ? -1 : 1;
  }
  if (leftScored && rightScored) {
    const byScore = right.score! - left.score!;
    if (byScore !== 0) {
      return byScore;
    }
  }
  const byProvider = left.provider.localeCompare(right.provider);
  if (byProvider !== 0) {
    return byProvider;
  }
  return left.model.localeCompare(right.model);
}

function rowPassesOneMillionFilter(row: ShelfRow, requireOneMillion: boolean): boolean {
  if (!requireOneMillion) {
    return true;
  }
  return typeof row.contextWindow === "number" && Number.isFinite(row.contextWindow) && row.contextWindow >= 1_000_000;
}

export type AttemptsForClassScalars = {
  toolNames?: string[];
  hasImage?: boolean;
  estimatedTokens?: number;
  toolTurn?: boolean;
  sessionId?: string;
};

export function attemptsForClass(
  parsed: ParsedClassRequest,
  modelRegistry: ModelRegistry | undefined,
  _scalars?: AttemptsForClassScalars
): RouteAttemptPlan[] | undefined {
  const snapshot = readShelfSnapshot();
  if (!snapshot) {
    return undefined;
  }
  const rows = [...snapshot.shelves[parsed.shelfClass]]
    .filter((row) => rowPassesOneMillionFilter(row, parsed.requireOneMillion))
    .filter((row) => !isBenched(row.provider, row.model))
    .sort(compareShelfRows);
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
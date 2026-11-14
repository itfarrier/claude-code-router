import { benchSortSignals, isBenched } from "@ccr/core/class-switch/bench";
import {
  readShelfSnapshot,
  type ShelfClass,
  type ShelfRow
} from "@ccr/core/class-switch/catalog";
import {
  decodeClaudeAppGatewayRouteId,
  stripClaudeAppGatewayOneMillionContextSuffix
} from "@ccr/core/agents/claude-app/gateway-routes";
import type { GatewayProviderConfig, ProviderModelMetadata } from "@ccr/core/contracts/app";
import { findProviderModelCatalogEntry } from "@ccr/core/gateway/model-catalog";
import { parseJsonObjectCached } from "@ccr/core/gateway/http/body";
import { estimateLimitUsage } from "@ccr/core/gateway/limits/window-limiter";
import {
  activeProviderCredentials,
  providerCredentialRuntimeId,
  providerCredentialSlug
} from "@ccr/core/providers/runtime-topology";
import type { ProviderModelRef, RouteAttemptPlan } from "@ccr/core/routing/contracts";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

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

function rowFailsToolRequest(row: ShelfRow, target: ProviderModelRef, toolNames: string[]): boolean {
  if (toolNames.length === 0) {
    return false;
  }
  const selector = `${row.provider}/${row.model}`;
  const entry = findProviderModelCatalogEntry(target.provider, row.model, [selector]);
  const capabilities = entry?.capabilities;
  return capabilities?.toolCalling === false || capabilities?.functionCalling === false;
}

function rowFailsImageRequest(row: ShelfRow, target: ProviderModelRef, hasImage: boolean): boolean {
  if (!hasImage) {
    return false;
  }
  const metadata = providerModelMetadata(target.provider, row.model);
  if (metadata?.capabilities?.imageInput === true) {
    return false;
  }
  if (metadata?.capabilities?.imageInput === false) {
    return true;
  }
  const selector = `${row.provider}/${row.model}`;
  const entry = findProviderModelCatalogEntry(target.provider, row.model, [selector]);
  const capabilities = entry?.capabilities;
  return capabilities?.imageInput === false || capabilities?.vision === false;
}

function rowFailsContext(row: ShelfRow, estimatedTokens: number): boolean {
  const window = row.contextWindow;
  return typeof window === "number" && Number.isFinite(window) && window > 0 && estimatedTokens > window;
}

function hasLiveCredential(provider: GatewayProviderConfig, row: ShelfRow): boolean {
  const credentials = activeProviderCredentials(provider);
  if (credentials.length === 0) {
    return !isBenched(row.provider, row.model);
  }
  return credentials.some((credential) => {
    // Omit the index argument: providerCredentialRuntimeId then resolves the
    // configured index via provider.credentials.indexOf, which is the same
    // slug the executor filters and the bench records. The filtered active
    // list skips disabled and keyless credentials, so its own index is not
    // the configured one.
    const slug = providerCredentialSlug(providerCredentialRuntimeId(provider, credential));
    return !isBenched(row.provider, row.model, slug);
  });
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
    const leftBench = benchSortSignals(left.provider, left.model);
    const rightBench = benchSortSignals(right.provider, right.model);
    if (leftBench.confirmed !== rightBench.confirmed) {
      return leftBench.confirmed ? -1 : 1;
    }
    const requestsTie = tieBreakRemainder(leftBench.remainingRequests, rightBench.remainingRequests);
    if (requestsTie !== 0) {
      return requestsTie;
    }
    const tokensTie = tieBreakRemainder(leftBench.remainingTokens, rightBench.remainingTokens);
    if (tokensTie !== 0) {
      return tokensTie;
    }
    const durationTie = tieBreakDuration(leftBench.lastSuccessDurationMs, rightBench.lastSuccessDurationMs);
    if (durationTie !== 0) {
      return durationTie;
    }
  }
  const byProvider = left.provider.localeCompare(right.provider);
  if (byProvider !== 0) {
    return byProvider;
  }
  return left.model.localeCompare(right.model);
}

function tieBreakRemainder(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return right - left;
}

function tieBreakDuration(left: number | undefined, right: number | undefined): number {
  if (left === undefined && right === undefined) {
    return 0;
  }
  if (left === undefined) {
    return 1;
  }
  if (right === undefined) {
    return -1;
  }
  return left - right;
}

function rowPassesOneMillionFilter(row: ShelfRow, requireOneMillion: boolean): boolean {
  if (!requireOneMillion) {
    return true;
  }
  return typeof row.contextWindow === "number" && Number.isFinite(row.contextWindow) && row.contextWindow >= 1_000_000;
}

// shortcut: the counter dies on process restart, which is the whole share
let thinShareCounter = 0;

export function setThinShareCounter(value: number): void {
  thinShareCounter = value;
}

function applyThinShare(rows: ShelfRow[]): ShelfRow[] {
  if (rows.length < 2) {
    return rows;
  }
  const leader = rows[0]!;
  const leaderScore = typeof leader.score === "number" && Number.isFinite(leader.score) ? leader.score : undefined;
  const leaderConfirmed = benchSortSignals(leader.provider, leader.model).confirmed;
  const neighborIndex = rows.findIndex((row, index) => {
    if (index === 0 || leaderScore === undefined) {
      return false;
    }
    const score = typeof row.score === "number" && Number.isFinite(row.score) ? row.score : undefined;
    if (score === undefined || Math.abs(score - leaderScore) > 2) {
      return false;
    }
    return benchSortSignals(row.provider, row.model).confirmed === leaderConfirmed;
  });
  if (neighborIndex <= 0) {
    return rows;
  }
  const reordered = [...rows];
  const [neighbor] = reordered.splice(neighborIndex, 1);
  reordered.unshift(neighbor);
  return reordered;
}

function finalizeRowOrder(rows: ShelfRow[]): ShelfRow[] {
  thinShareCounter += 1;
  if (thinShareCounter % 20 === 0) {
    return applyThinShare(rows);
  }
  return rows;
}

function buildAttempts(
  rows: ShelfRow[],
  modelRegistry: ModelRegistry | undefined
): RouteAttemptPlan[] {
  const attempts: RouteAttemptPlan[] = [];
  for (const row of rows) {
    const selector = `${row.provider}/${row.model}`;
    const target = modelRegistry?.resolve(selector);
    if (target?.kind !== "provider") {
      continue;
    }
  const provider = target.provider;
    const credentials = activeProviderCredentials(provider);
    if (credentials.length === 0) {
      if (!isBenched(row.provider, row.model)) {
        attempts.push({
          index: attempts.length,
          model: selector,
          target
        });
      }
      continue;
    }
    if (!hasLiveCredential(provider, row)) {
      continue;
    }
    for (const credential of credentials) {
      const slug = providerCredentialSlug(providerCredentialRuntimeId(provider, credential));
      if (isBenched(row.provider, row.model, slug)) {
        continue;
      }
      attempts.push({
        index: attempts.length,
        model: selector,
        target
      });
    }
  }
  return attempts;
}

export type AttemptsForClassScalars = {
  toolNames?: string[];
  hasImage?: boolean;
  estimatedTokens?: number;
  toolTurn?: boolean;
  sessionId?: string;
};

function toolTurnAttempt(
  parsed: ParsedClassRequest,
  modelRegistry: ModelRegistry | undefined,
  sessionId: string
): RouteAttemptPlan[] | undefined {
  const triple = rememberedCredential(sessionId);
  if (!triple) {
    return undefined;
  }
  if (isBenched(triple.provider, triple.model, triple.credentialId)) {
    toolTurnBySession.delete(sessionId);
    return undefined;
  }
  const selector = `${triple.provider}/${triple.model}`;
  const target = modelRegistry?.resolve(selector);
  if (target?.kind !== "provider") {
    return undefined;
  }
  const credentials = activeProviderCredentials(target.provider);
  const match = credentials.find((credential) => {
    const runtimeId = providerCredentialRuntimeId(target.provider, credential);
    const slug = providerCredentialSlug(runtimeId);
    return runtimeId === triple.credentialId || slug === triple.credentialId;
  });
  if (!match) {
    return undefined;
  }
  return [
    {
      index: 0,
      model: selector,
      target
    }
  ];
}

export function attemptsForClass(
  parsed: ParsedClassRequest,
  modelRegistry: ModelRegistry | undefined,
  scalars?: AttemptsForClassScalars
): RouteAttemptPlan[] | undefined {
  const toolNames = scalars?.toolNames ?? [];
  const hasImage = scalars?.hasImage ?? false;
  const estimatedTokens = scalars?.estimatedTokens ?? 0;
  const sessionId = scalars?.sessionId?.trim();

  if (scalars?.toolTurn && sessionId) {
    const sticky = toolTurnAttempt(parsed, modelRegistry, sessionId);
    if (sticky) {
      thinShareCounter += 1;
      return sticky;
    }
  }

  const snapshot = readShelfSnapshot();
  if (!snapshot) {
    return undefined;
  }

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
}

const IMAGE_BLOCK_TYPES = new Set(["image", "image_url", "input_image"]);
const TEXT_BLOCK_TYPES = new Set(["text", "input_text", "output_text"]);

export function liftToolResultImages(body: Record<string, unknown>): Record<string, unknown> {
  const messages = body.messages;
  if (!Array.isArray(messages)) {
    return body;
  }
  const nextMessages = messages.map((message) => {
    if (!isRecord(message) || message.role !== "user" || !Array.isArray(message.content)) {
      return message;
    }
    const content = [...message.content];
    let changed = false;
    for (let blockIndex = 0; blockIndex < content.length; blockIndex += 1) {
      const block = content[blockIndex];
      if (!isRecord(block) || block.type !== "tool_result" || !Array.isArray(block.content)) {
        continue;
      }
      const toolContent = [...block.content];
      const keep: unknown[] = [];
      const images: unknown[] = [];
      for (const piece of toolContent) {
        if (isRecord(piece) && IMAGE_BLOCK_TYPES.has(String(piece.type))) {
          images.push(piece);
        } else {
          keep.push(piece);
        }
      }
      if (images.length === 0) {
        continue;
      }
      const hasText = keep.some(
        (piece) => isRecord(piece) && TEXT_BLOCK_TYPES.has(String(piece.type)) && String(piece.text ?? "").length > 0
      );
      if (!hasText) {
        keep.push({ text: "image", type: "text" });
      }
      content.splice(blockIndex, 1, { ...block, content: keep });
      content.push(...images);
      changed = true;
    }
    return changed ? { ...message, content } : message;
  });
  return nextMessages === messages ? body : { ...body, messages: nextMessages };
}

export type RequestFacts = {
  estimatedTokens: number;
  hasImage: boolean;
  sessionId?: string;
  toolNames: string[];
  toolTurn: boolean;
};

function toolNamesFromBody(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((tool) => {
    if (!isRecord(tool)) {
      return [];
    }
    const fn = isRecord(tool.function) ? tool.function : undefined;
    const name =
      typeof tool.name === "string" ? tool.name : typeof fn?.name === "string" ? fn.name : undefined;
    return name ? [name] : [];
  });
}

function isToolTurnBody(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }
  const last = messages[messages.length - 1];
  if (!isRecord(last) || last.role !== "user" || !Array.isArray(last.content) || last.content.length === 0) {
    return false;
  }
  return last.content.every((block) => isRecord(block) && block.type === "tool_result");
}

export function requestFacts(method: string, body: Buffer): RequestFacts {
  const usage = estimateLimitUsage(method, body);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = parseJsonObjectCached(body);
  } catch {
    parsed = {};
  }
  const metadata = parsed.metadata;
  const sessionId =
    isRecord(metadata) && typeof metadata.session_id === "string" && metadata.session_id.trim()
      ? metadata.session_id.trim()
      : undefined;
  return {
    estimatedTokens: usage.totalTokens,
    hasImage: usage.imageCount > 0,
    sessionId,
    toolNames: toolNamesFromBody(parsed.tools),
    toolTurn: isToolTurnBody(parsed.messages)
  };
}

export type RememberedTriple = {
  credentialId: string;
  model: string;
  provider: string;
};

// shortcut: process memory only, a restart ends the tool-turn stickiness
const toolTurnBySession = new Map<string, RememberedTriple>();

export function remember(sessionId: string | undefined, triple: RememberedTriple): void {
  if (!sessionId?.trim()) {
    return;
  }
  toolTurnBySession.set(sessionId.trim(), triple);
}

export function rememberedCredential(sessionId: string | undefined): RememberedTriple | undefined {
  if (!sessionId?.trim()) {
    return undefined;
  }
  return toolTurnBySession.get(sessionId.trim());
}
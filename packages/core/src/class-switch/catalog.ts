import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import {
  effectiveContextWindowPercentFor,
  isGatewayProviderEnabled,
  type AppConfig,
  type GatewayProviderCapabilityProtocol,
  type GatewayProviderConfig,
  type GatewayProviderProtocol,
  type ProviderCredentialConfig,
  type ProviderModelMetadata
} from "@ccr/core/contracts/app";
import {
  findModelCatalogEntry,
  findProviderModelCatalogEntry,
  modelCatalogMaxInputTokens
} from "@ccr/core/gateway/model-catalog";
import { providerModelAutoRefreshIntervalMs } from "@ccr/core/providers/model-auto-refresh";
import { probeGatewayProvider } from "@ccr/core/providers/probe";
import { providerRuntimeId } from "@ccr/core/routing/model-registry";
import { loadAppConfig } from "@ccr/core/config/config";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";

export type ShelfClass = "fable" | "opus" | "sonnet" | "haiku";

export type ShelfRow = {
  provider: string;
  model: string;
  contextWindow?: number;
  score?: number;
  tierClass?: ShelfClass;
};

export type ShelfSnapshot = {
  excluded: Array<ShelfRow & { reason: "batch" | "no-index" | "non-text" }>;
  review: Array<
    ShelfRow & { reason: "score-tier-disagree"; scoreClass: ShelfClass; tierClass: ShelfClass }
  >;
  shelves: Record<ShelfClass, ShelfRow[]>;
  updatedAt: string;
};

export type ArtificialAnalysisIndexes = {
  coding_index?: number | null;
  agentic_index?: number | null;
  intelligence_index?: number | null;
};

export type ClassifyInput = {
  provider: string;
  model: string;
  artificialAnalysis?: ArtificialAnalysisIndexes;
  contextWindow?: number;
  outputModalities?: string[];
  architectureModality?: string;
};

export type ClassifyResult =
  | { kind: "shelf"; class: ShelfClass; score?: number; tierClass?: ShelfClass }
  | { kind: "excluded"; reason: "no-index" | "batch" | "non-text" }
  | {
      kind: "review";
      reason: "score-tier-disagree";
      scoreClass: ShelfClass;
      tierClass: ShelfClass;
      score?: number;
    };

export type OpenRouterModelRow = {
  architecture?: {
    modality?: string;
    output_modalities?: string[];
  };
  benchmarks?: { artificial_analysis?: ArtificialAnalysisIndexes };
  canonical_slug?: string;
  context_length?: number;
  id?: string;
  top_provider?: { context_length?: number };
};

const INDEX_WEIGHTS = {
  coding_index: 0.5,
  agentic_index: 0.3,
  intelligence_index: 0.2
} as const;

function finiteIndex(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function scoreArtificialAnalysis(indexes: ArtificialAnalysisIndexes | undefined): number | undefined {
  if (!indexes) {
    return undefined;
  }
  const present: Array<{ key: keyof typeof INDEX_WEIGHTS; value: number }> = [];
  for (const key of Object.keys(INDEX_WEIGHTS) as Array<keyof typeof INDEX_WEIGHTS>) {
    const value = finiteIndex(indexes[key]);
    if (value !== undefined) {
      present.push({ key, value });
    }
  }
  if (!present.length) {
    return undefined;
  }
  const weightSum = present.reduce((sum, entry) => sum + INDEX_WEIGHTS[entry.key], 0);
  const weighted = present.reduce((sum, entry) => sum + INDEX_WEIGHTS[entry.key] * entry.value, 0);
  return weighted / weightSum;
}

const SHELF_CLASS_ORDER: ShelfClass[] = ["fable", "opus", "sonnet", "haiku"];

const IGNORED_TIER_TOKENS = new Set(["flash", "mini", "nano", "lite"]);

const NON_TEXT_ID_TOKENS = new Set([
  "embed",
  "embedding",
  "whisper",
  "tts",
  "ocr",
  "rerank",
  "moderation"
]);

function fold(value: string): string {
  return value.toLowerCase();
}

function tierClassForToken(token: string): ShelfClass | undefined {
  const folded = fold(token);
  if (folded === "fable" || folded === "astra") {
    return "fable";
  }
  if (folded === "opus" || folded === "sol") {
    return "opus";
  }
  if (folded === "sonnet" || folded === "terra") {
    return "sonnet";
  }
  if (folded === "haiku" || folded === "luna") {
    return "haiku";
  }
  return undefined;
}

function modelIdTokens(modelId: string): string[] {
  return modelId.split(/[^a-zA-Z0-9]+/).filter(Boolean);
}

function tierClassesFromModelId(modelId: string): ShelfClass[] {
  const seen = new Set<ShelfClass>();
  const classes: ShelfClass[] = [];
  for (const token of modelIdTokens(modelId)) {
    if (IGNORED_TIER_TOKENS.has(fold(token))) {
      continue;
    }
    const tierClass = tierClassForToken(token);
    if (tierClass && !seen.has(tierClass)) {
      seen.add(tierClass);
      classes.push(tierClass);
    }
  }
  return classes;
}

function classDistance(a: ShelfClass, b: ShelfClass): number {
  return Math.abs(SHELF_CLASS_ORDER.indexOf(a) - SHELF_CLASS_ORDER.indexOf(b));
}

function higherShelfClass(a: ShelfClass, b: ShelfClass): ShelfClass {
  return SHELF_CLASS_ORDER.indexOf(a) < SHELF_CLASS_ORDER.indexOf(b) ? a : b;
}

function isBatchModelId(modelId: string): boolean {
  return modelId.split(":").some((segment) => fold(segment) === "batch");
}

function architectureOutputSide(modality: string): string | undefined {
  const parts = modality.split("->");
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function modalityTokens(side: string): string[] {
  return side.split("+").map((part) => fold(part.trim())).filter(Boolean);
}

function isNonTextModel(input: ClassifyInput): boolean {
  for (const token of modelIdTokens(input.model)) {
    if (NON_TEXT_ID_TOKENS.has(fold(token))) {
      return true;
    }
  }
  const outputs = input.outputModalities;
  if (outputs !== undefined) {
    if (!outputs.length) {
      return true;
    }
    const hasText = outputs.some((modality) => fold(modality) === "text");
    if (!hasText) {
      return true;
    }
  }
  const architecture = input.architectureModality;
  if (architecture) {
    const outputSide = architectureOutputSide(architecture);
    if (outputSide) {
      const tokens = modalityTokens(outputSide);
      if (!tokens.includes("text")) {
        return true;
      }
      if (tokens.some((token) => token === "image" || token === "audio" || token === "video")) {
        return true;
      }
    }
  }
  return false;
}

function presentIndexCount(indexes: ArtificialAnalysisIndexes | undefined): number {
  return (["coding_index", "agentic_index", "intelligence_index"] as const).filter(
    (key) => finiteIndex(indexes?.[key]) !== undefined
  ).length;
}

export function classForScore(score: number, presentIndexCount = 3): ShelfClass {
  let shelfClass: ShelfClass;
  if (score >= 62) {
    shelfClass = "fable";
  } else if (score >= 50) {
    shelfClass = "opus";
  } else if (score >= 28) {
    shelfClass = "sonnet";
  } else {
    shelfClass = "haiku";
  }
  if (presentIndexCount === 1 && (shelfClass === "fable" || shelfClass === "opus")) {
    return "sonnet";
  }
  return shelfClass;
}

function shelfFromTierOnly(tierClasses: ShelfClass[]): ClassifyResult {
  if (!tierClasses.length) {
    return { kind: "excluded", reason: "no-index" };
  }
  if (tierClasses.length === 1) {
    const tierClass = tierClasses[0];
    return { kind: "shelf", class: tierClass, tierClass };
  }
  const higher = tierClasses.reduce((left, right) => higherShelfClass(left, right));
  const lower = tierClasses.reduce((left, right) =>
    SHELF_CLASS_ORDER.indexOf(left) > SHELF_CLASS_ORDER.indexOf(right) ? left : right
  );
  const distance = classDistance(higher, lower);
  if (distance > 1) {
    return {
      kind: "review",
      reason: "score-tier-disagree",
      scoreClass: higher,
      tierClass: lower
    };
  }
  return { kind: "shelf", class: higher, tierClass: higher };
}

export function classifyModel(input: ClassifyInput): ClassifyResult {
  if (isBatchModelId(input.model)) {
    return { kind: "excluded", reason: "batch" };
  }
  if (isNonTextModel(input)) {
    return { kind: "excluded", reason: "non-text" };
  }

  const tierClasses = tierClassesFromModelId(input.model);
  const score = scoreArtificialAnalysis(input.artificialAnalysis);
  const presentCount = presentIndexCount(input.artificialAnalysis);

  if (score === undefined) {
    return shelfFromTierOnly(tierClasses);
  }

  const scoreClass = classForScore(score, presentCount);

  if (!tierClasses.length) {
    return { kind: "shelf", class: scoreClass, score };
  }

  const tierClass = tierClasses.reduce((left, right) =>
    classDistance(scoreClass, right) > classDistance(scoreClass, left) ? right : left
  );
  const distance = classDistance(scoreClass, tierClass);
  if (distance <= 1) {
    return { kind: "shelf", class: scoreClass, score, tierClass };
  }

  return {
    kind: "review",
    reason: "score-tier-disagree",
    scoreClass,
    tierClass,
    score
  };
}

export function matchOpenRouterModel(
  modelId: string,
  rows: OpenRouterModelRow[]
): OpenRouterModelRow | undefined {
  const target = fold(modelId);
  const idMatches = rows.filter(
    (row) => fold(row.id ?? "") === target || fold(row.canonical_slug ?? "") === target
  );
  if (idMatches.length === 1) {
    return idMatches[0];
  }
  if (idMatches.length > 1) {
    return undefined;
  }
  if (modelId.includes("/")) {
    return undefined;
  }
  const segmentMatches = rows.filter((row) => {
    const id = row.id ?? row.canonical_slug ?? "";
    const segment = id.split("/").pop() ?? "";
    return fold(segment) === target;
  });
  return segmentMatches.length === 1 ? segmentMatches[0] : undefined;
}

export function shelfSnapshotPath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "class-switch-shelves.json");
}

function isShelfSnapshot(value: unknown): value is ShelfSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const snapshot = value as ShelfSnapshot;
  if (typeof snapshot.updatedAt !== "string") {
    return false;
  }
  if (!Array.isArray(snapshot.excluded) || !Array.isArray(snapshot.review)) {
    return false;
  }
  const shelves = snapshot.shelves;
  if (!shelves || typeof shelves !== "object") {
    return false;
  }
  for (const shelfClass of ["fable", "opus", "sonnet", "haiku"] as const) {
    const rows = shelves[shelfClass];
    if (!Array.isArray(rows)) {
      return false;
    }
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        return false;
      }
      if (typeof row.provider !== "string" || typeof row.model !== "string") {
        return false;
      }
    }
  }
  for (const row of snapshot.excluded) {
    if (!row || typeof row !== "object") {
      return false;
    }
    if (typeof row.provider !== "string" || typeof row.model !== "string") {
      return false;
    }
  }
  for (const row of snapshot.review) {
    if (!row || typeof row !== "object") {
      return false;
    }
    if (typeof row.provider !== "string" || typeof row.model !== "string") {
      return false;
    }
  }
  return true;
}

export function readShelfSnapshot(): ShelfSnapshot | undefined {
  try {
    const raw = readFileSync(shelfSnapshotPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isShelfSnapshot(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export type ContextWindowForProviderModelInput = {
  catalogMaxInputTokens?: number;
  metadata?: import("@ccr/core/contracts/app").ProviderModelMetadata;
  openRouterContextLength?: number;
  openRouterTopProviderContextLength?: number;
};

function positiveContextInteger(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

export function contextWindowForProviderModel(
  input: ContextWindowForProviderModelInput
): number | undefined {
  const metadata = input.metadata;
  const metadataWindow =
    positiveContextInteger(metadata?.contextWindow) ?? positiveContextInteger(metadata?.maxContextWindow);
  if (metadataWindow) {
    const effectivePercent = effectiveContextWindowPercentFor(metadata) ?? 100;
    return Math.max(1, Math.floor((metadataWindow * effectivePercent) / 100));
  }
  const catalogMax = positiveContextInteger(input.catalogMaxInputTokens);
  if (catalogMax) {
    return catalogMax;
  }
  const openRouterLength = positiveContextInteger(input.openRouterContextLength);
  if (openRouterLength) {
    return openRouterLength;
  }
  const openRouterTop = positiveContextInteger(input.openRouterTopProviderContextLength);
  if (openRouterTop) {
    return openRouterTop;
  }
  return undefined;
}

type ClassSwitchCatalogProbe = typeof probeGatewayProvider;

export type ClassSwitchCatalogOptions = {
  fetchScores?: () => Promise<{ ok: boolean; rows: OpenRouterModelRow[] }>;
  loadConfig?: () => Promise<AppConfig>;
  logger?: Pick<Console, "warn">;
  probeProvider?: ClassSwitchCatalogProbe;
  schedule?: (delayMs: number, run: () => void | Promise<void>) => void;
};

let catalogWalkEnabled = false;
let catalogWalkTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<void> | undefined;
let refreshAgain = false;
let walkGeneration = 0;

function formatCatalogError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyShelfSnapshot(): ShelfSnapshot {
  return {
    excluded: [],
    review: [],
    shelves: { fable: [], haiku: [], opus: [], sonnet: [] },
    updatedAt: new Date().toISOString()
  };
}

function providerBaseUrl(provider: GatewayProviderConfig): string {
  return (provider.api_base_url || provider.baseUrl || provider.baseurl || "").trim();
}

function providerCredentialApiKey(credential: ProviderCredentialConfig): string {
  return (credential.api_key || credential.apiKey || credential.apikey || "").trim();
}

function providerApiKeyForModelRefresh(provider: GatewayProviderConfig): string {
  const direct = provider.api_key || provider.apiKey || provider.apikey || "";
  if (direct.trim()) {
    return direct.trim();
  }
  return provider.credentials
    ?.filter((credential) => credential.enabled !== false)
    .map(providerCredentialApiKey)
    .find(Boolean) ?? "";
}

const gatewayProviderProtocols = new Set<GatewayProviderProtocol>([
  "anthropic_messages",
  "gemini_generate_content",
  "gemini_interactions",
  "openai_chat_completions",
  "openai_responses"
]);

function toGatewayProviderProtocol(value: unknown): GatewayProviderProtocol | undefined {
  return typeof value === "string" && gatewayProviderProtocols.has(value as GatewayProviderProtocol)
    ? value as GatewayProviderProtocol
    : undefined;
}

function providerModelRefreshProtocols(provider: GatewayProviderConfig): GatewayProviderCapabilityProtocol[] {
  const protocols = new Set<GatewayProviderCapabilityProtocol>();
  for (const capability of provider.capabilities ?? []) {
    protocols.add(capability.type);
  }
  const typeProtocol = toGatewayProviderProtocol(provider.type);
  if (typeProtocol) {
    protocols.add(typeProtocol);
  }
  const providerProtocol = toGatewayProviderProtocol(provider.provider);
  if (providerProtocol) {
    protocols.add(providerProtocol);
  }
  return [...protocols];
}

function providerPluginEnabled(plugin: unknown): boolean {
  return !(plugin && typeof plugin === "object" && !Array.isArray(plugin) && (plugin as { enabled?: boolean }).enabled === false);
}

function providerPluginAliases(provider: GatewayProviderConfig): Set<string> {
  const aliases = new Set(
    [provider.name, provider.id, provider.provider, providerRuntimeId(provider)]
      .map((value) => value?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value))
  );
  const protocols = providerModelRefreshProtocols(provider);
  for (const alias of [...aliases]) {
    for (const protocol of protocols) {
      aliases.add(`${alias}::${protocol}`);
    }
  }
  return aliases;
}

function providerPluginsForModelRefresh(config: AppConfig, provider: GatewayProviderConfig): unknown[] {
  return (config.providerPlugins ?? []).filter((plugin) => {
    if (!providerPluginEnabled(plugin) || !plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
      return false;
    }
    const record = plugin as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key.trim().toLowerCase() : "";
    if (!key.startsWith("ccr-local-agent-")) {
      return false;
    }
    const pluginProviderName = (typeof record.providerName === "string" ? record.providerName : typeof record.provider === "string" ? record.provider : "").trim().toLowerCase();
    return Boolean(pluginProviderName && providerPluginAliases(provider).has(pluginProviderName));
  });
}

function providerModelMetadataFor(
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

function catalogMaxForProviderModel(provider: GatewayProviderConfig, model: string): number | undefined {
  const selector = `${provider.name?.trim()}/${model}`;
  const entry = findProviderModelCatalogEntry(provider, model, [selector]) ?? findModelCatalogEntry(selector);
  const max = modelCatalogMaxInputTokens(entry);
  return max > 0 ? max : undefined;
}

function copyProviderRows(target: ShelfSnapshot, source: ShelfSnapshot, providerName: string): void {
  for (const shelfClass of SHELF_CLASS_ORDER) {
    target.shelves[shelfClass].push(...source.shelves[shelfClass].filter((row) => row.provider === providerName));
  }
  target.excluded.push(...source.excluded.filter((row) => row.provider === providerName));
  target.review.push(...source.review.filter((row) => row.provider === providerName));
}

type PriorShelfPlacement =
  | ({ placement: "shelf"; shelfClass: ShelfClass } & ShelfRow)
  | ({ placement: "excluded" } & ShelfSnapshot["excluded"][number])
  | ({ placement: "review" } & ShelfSnapshot["review"][number]);

function findPreviousRow(
  snapshot: ShelfSnapshot,
  providerName: string,
  model: string
): PriorShelfPlacement | undefined {
  for (const shelfClass of SHELF_CLASS_ORDER) {
    const row = snapshot.shelves[shelfClass].find((entry) => entry.provider === providerName && entry.model === model);
    if (row) {
      return { placement: "shelf", shelfClass, ...row };
    }
  }
  const excluded = snapshot.excluded.find((entry) => entry.provider === providerName && entry.model === model);
  if (excluded) {
    return { placement: "excluded", ...excluded };
  }
  const review = snapshot.review.find((entry) => entry.provider === providerName && entry.model === model);
  if (review) {
    return { placement: "review", ...review };
  }
  return undefined;
}

function placePreviousRow(snapshot: ShelfSnapshot, prior: PriorShelfPlacement, contextWindow?: number): void {
  const { placement, ...row } = prior;
  const next: ShelfRow = {
    provider: row.provider,
    model: row.model,
    ...(row.score !== undefined ? { score: row.score } : {}),
    ...(row.tierClass ? { tierClass: row.tierClass } : {}),
    ...(contextWindow !== undefined
      ? { contextWindow }
      : row.contextWindow !== undefined
        ? { contextWindow: row.contextWindow }
        : {})
  };
  if (placement === "shelf") {
    snapshot.shelves[prior.shelfClass].push(next);
    return;
  }
  if (placement === "excluded") {
    snapshot.excluded.push({ ...next, reason: prior.reason });
    return;
  }
  snapshot.review.push({
    ...next,
    reason: prior.reason,
    scoreClass: prior.scoreClass,
    tierClass: prior.tierClass
  });
}

function placeClassifyResult(snapshot: ShelfSnapshot, base: ShelfRow, result: ClassifyResult): void {
  if (result.kind === "shelf") {
    snapshot.shelves[result.class].push({
      ...base,
      ...(result.score !== undefined ? { score: result.score } : {}),
      ...(result.tierClass ? { tierClass: result.tierClass } : {})
    });
    return;
  }
  if (result.kind === "excluded") {
    snapshot.excluded.push({ ...base, reason: result.reason });
    return;
  }
  snapshot.review.push({
    ...base,
    reason: result.reason,
    scoreClass: result.scoreClass,
    tierClass: result.tierClass,
    ...(result.score !== undefined ? { score: result.score } : {})
  });
}

function openRouterHostKey(provider: GatewayProviderConfig): string | undefined {
  const baseUrl = providerBaseUrl(provider);
  if (!baseUrl) {
    return undefined;
  }
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function openRouterApiKey(config: AppConfig): string | undefined {
  for (const provider of config.Providers) {
    if (!isGatewayProviderEnabled(provider) || openRouterHostKey(provider) !== "openrouter.ai") {
      continue;
    }
    const key = providerApiKeyForModelRefresh(provider);
    if (key) {
      return key;
    }
  }
  return undefined;
}

function authorizationHeader(apiKey: string): string {
  return /^Bearer\s+/i.test(apiKey) ? apiKey.trim() : `Bearer ${apiKey.trim()}`;
}

function parseOpenRouterScoreRows(payload: unknown): OpenRouterModelRow[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((row): row is OpenRouterModelRow => Boolean(row && typeof row === "object"));
}

async function fetchOpenRouterScoreRows(
  config: AppConfig,
  options: ClassSwitchCatalogOptions
): Promise<OpenRouterModelRow[] | undefined> {
  if (options.fetchScores) {
    const result = await options.fetchScores();
    return result.ok ? result.rows : undefined;
  }
  const url = "https://openrouter.ai/api/v1/models";
  const request = async (apiKey?: string) =>
    fetch(url, {
      headers: {
        accept: "application/json",
        "cache-control": "no-cache",
        ...(apiKey ? { authorization: authorizationHeader(apiKey) } : {})
      },
      signal: AbortSignal.timeout(10_000)
    });
  try {
    let response = await request();
    if (response.status === 401) {
      const retryKey = openRouterApiKey(config);
      if (!retryKey) {
        return undefined;
      }
      response = await request(retryKey);
    }
    if (!response.ok) {
      return undefined;
    }
    return parseOpenRouterScoreRows(await response.json());
  } catch {
    return undefined;
  }
}

function classifyProviderModels(
  _config: AppConfig,
  provider: GatewayProviderConfig,
  modelIds: string[],
  scoreRows: OpenRouterModelRow[] | undefined,
  previous: ShelfSnapshot,
  scoresFailed: boolean,
  target: ShelfSnapshot
): void {
  const providerName = provider.name?.trim() ?? "";
  const seen = new Set<string>();
  for (const rawModel of modelIds) {
    const model = rawModel.trim();
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    const openRouterRow = scoreRows ? matchOpenRouterModel(model, scoreRows) : undefined;
    const metadata = providerModelMetadataFor(provider, model);
    const window = contextWindowForProviderModel({
      metadata,
      catalogMaxInputTokens: catalogMaxForProviderModel(provider, model),
      openRouterContextLength: openRouterRow?.context_length,
      openRouterTopProviderContextLength: openRouterRow?.top_provider?.context_length
    });
    const prior = scoresFailed ? findPreviousRow(previous, providerName, model) : undefined;
    if (scoresFailed && prior) {
      placePreviousRow(target, prior, window);
      continue;
    }
    const base: ShelfRow = window ? { model, provider: providerName, contextWindow: window } : { model, provider: providerName };
    const architecture = openRouterRow?.architecture;
    const classified = classifyModel({
      artificialAnalysis: openRouterRow?.benchmarks?.artificial_analysis,
      architectureModality: architecture?.modality,
      model,
      outputModalities: architecture?.output_modalities,
      provider: providerName
    });
    placeClassifyResult(target, base, classified);
  }
}

function buildSeedSnapshot(config: AppConfig): ShelfSnapshot {
  const snapshot = emptyShelfSnapshot();
  for (const provider of config.Providers) {
    if (!isGatewayProviderEnabled(provider)) {
      continue;
    }
    classifyProviderModels(config, provider, provider.models ?? [], undefined, snapshot, false, snapshot);
  }
  snapshot.updatedAt = new Date().toISOString();
  return snapshot;
}

export async function seedShelvesFromConfig(config: AppConfig): Promise<void> {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  if (readShelfSnapshot()) {
    return;
  }
  await writeShelfSnapshot(buildSeedSnapshot(config));
}

export async function refreshClassShelves(
  config: AppConfig,
  options: ClassSwitchCatalogOptions = {}
): Promise<ShelfSnapshot> {
  const probeProvider = options.probeProvider ?? probeGatewayProvider;
  const previous = readShelfSnapshot() ?? emptyShelfSnapshot();
  const scoreRows = await fetchOpenRouterScoreRows(config, options);
  const scoresFailed = scoreRows === undefined;
  const snapshot = emptyShelfSnapshot();

  for (const provider of config.Providers) {
    if (!isGatewayProviderEnabled(provider)) {
      continue;
    }
    const providerName = provider.name?.trim() ?? "";
    const baseUrl = providerBaseUrl(provider);
    if (!providerName || !baseUrl) {
      continue;
    }
    try {
      const probe = await probeProvider({
        apiKey: providerApiKeyForModelRefresh(provider),
        baseUrl,
        forceRefresh: true,
        mode: "models",
        models: provider.models,
        providerPlugins: providerPluginsForModelRefresh(config, provider),
        protocols: providerModelRefreshProtocols(provider)
      });
      if (!Array.isArray(probe.models)) {
        copyProviderRows(snapshot, previous, providerName);
        continue;
      }
      classifyProviderModels(config, provider, probe.models, scoreRows, previous, scoresFailed, snapshot);
    } catch (error) {
      options.logger?.warn?.(`[class-switch] Failed to refresh models for ${providerName}: ${formatCatalogError(error)}`);
      copyProviderRows(snapshot, previous, providerName);
    }
  }

  snapshot.updatedAt = new Date().toISOString();
  await writeShelfSnapshot(snapshot);
  return snapshot;
}

function defaultCatalogSchedule(delayMs: number, run: () => void | Promise<void>): void {
  // shortcut: providers with autoFetchModels are listed twice per 10 minutes, merge only if model-auto-refresh.ts becomes editable
  if (catalogWalkTimer) {
    clearTimeout(catalogWalkTimer);
  }
  catalogWalkTimer = setTimeout(() => {
    catalogWalkTimer = undefined;
    void Promise.resolve(run());
  }, delayMs);
  catalogWalkTimer.unref?.();
}

async function runSerializedRefresh(options: ClassSwitchCatalogOptions): Promise<void> {
  if (refreshInFlight) {
    refreshAgain = true;
    try {
      await refreshInFlight;
    } catch {
      // The failed pass must not drop a start that set refreshAgain.
    }
    if (refreshAgain && catalogWalkEnabled) {
      return runSerializedRefresh(options);
    }
    return;
  }
  const generation = walkGeneration;
  refreshInFlight = (async () => {
    do {
      refreshAgain = false;
      const loadConfig = options.loadConfig ?? loadAppConfig;
      await refreshClassShelves(await loadConfig(), options);
    } while (refreshAgain && catalogWalkEnabled && generation === walkGeneration);
  })().finally(() => {
    refreshInFlight = undefined;
  });
  return refreshInFlight;
}

function scheduleCatalogWalk(
  config: AppConfig,
  options: ClassSwitchCatalogOptions,
  delayMs: number
): void {
  if (!catalogWalkEnabled) {
    return;
  }
  const walkGen = walkGeneration;
  const schedule = options.schedule ?? defaultCatalogSchedule;
  schedule(delayMs, async () => {
    if (walkGen !== walkGeneration) {
      return;
    }
    try {
      await runSerializedRefresh(options);
    } catch (error) {
      options.logger?.warn?.(`[class-switch] Catalog refresh failed: ${formatCatalogError(error)}`);
    }
    if (catalogWalkEnabled && walkGen === walkGeneration) {
      scheduleCatalogWalk(config, options, providerModelAutoRefreshIntervalMs);
    }
  });
}

export function startClassSwitchCatalog(config: AppConfig, options: ClassSwitchCatalogOptions = {}): void {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  catalogWalkEnabled = true;
  walkGeneration += 1;
  if (refreshInFlight) {
    refreshAgain = true;
  }
  void seedShelvesFromConfig(config)
    .catch((error) => {
      options.logger?.warn?.(`[class-switch] Shelf seed failed: ${formatCatalogError(error)}`);
    })
    .finally(() => {
      scheduleCatalogWalk(config, options, 0);
    });
}

export function stopClassSwitchCatalog(): void {
  catalogWalkEnabled = false;
  if (catalogWalkTimer) {
    clearTimeout(catalogWalkTimer);
    catalogWalkTimer = undefined;
  }
}

export async function writeShelfSnapshot(snapshot: ShelfSnapshot): Promise<void> {
  const file = shelfSnapshotPath();
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporaryFile, JSON.stringify(snapshot), "utf8");
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}
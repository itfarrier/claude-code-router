import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import type { AppConfig, GatewayProviderConfig, GatewayProviderProbeRequest, ProviderCredentialConfig } from "@ccr/core/contracts/app";
import { loadAppConfig } from "@ccr/core/config/config";
import { readShelfSnapshot, type ShelfRow } from "@ccr/core/class-switch/catalog";
import { probeGatewayProvider } from "@ccr/core/providers/probe";
import {
  activeProviderCredentials,
  providerCredentialRuntimeId,
  providerCredentialSlug
} from "@ccr/core/providers/runtime-topology";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";

const bench5xxMs = 30_000;
const bench401Ms = 5 * 60_000;
const bench404Ms = 60 * 60_000;
const bench429NoClockMs = 60_000;
const benchProbePeriodMs = 30_000;

type BenchRow = {
  confirmed?: boolean;
  dueAt?: number;
  lastSuccessDurationMs?: number;
  nextProbeAt?: number;
  probe?: boolean;
  remainingRequests?: number;
  remainingTokens?: number;
  resetDurationMs?: number;
  sampledAt?: number;
  until?: number;
};

const benchRows = new Map<string, BenchRow>();
let benchLoaded = false;
let benchTimer: ReturnType<typeof setTimeout> | undefined;
let benchOptions: ClassSwitchBenchOptions | undefined;
let benchStartConfig: AppConfig | undefined;
let shelfDueMarks = new Map<string, number>();

export type ClassSwitchBenchOptions = {
  loadConfig?: () => Promise<AppConfig>;
  now?: () => number;
  probeProvider?: (request: GatewayProviderProbeRequest) => Promise<unknown>;
  schedule?: (delayMs: number, run: () => void | Promise<void>) => void;
};

function benchNow(): number {
  return benchOptions?.now?.() ?? Date.now();
}

function benchRowKey(provider: string, credentialId: string, model: string): string {
  return `${provider.trim()}\0${credentialId}\0${model.trim()}`;
}

function parseBenchRows(raw: unknown, now: number): Record<string, BenchRow> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const rows: Record<string, BenchRow> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const row = value as BenchRow;
    if (typeof row.until === "number" && Number.isFinite(row.until) && row.until > now) {
      rows[key] = { ...row };
    } else if (row.probe === false || row.confirmed || row.dueAt || row.nextProbeAt || row.sampledAt) {
      rows[key] = { ...row };
    }
  }
  return rows;
}

export function benchSnapshotPath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "class-switch-bench.json");
}

function syncRowsFromMap(): Record<string, BenchRow> {
  const now = benchNow();
  const rows: Record<string, BenchRow> = {};
  for (const [key, row] of benchRows) {
    if (typeof row.until === "number" && row.until <= now && row.probe !== false && !row.confirmed && !row.dueAt) {
      continue;
    }
    rows[key] = { ...row };
  }
  return rows;
}

async function writeBenchSnapshot(): Promise<void> {
  const file = benchSnapshotPath();
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  const payload = syncRowsFromMap();
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporaryFile, JSON.stringify(payload), "utf8");
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

function loadBenchFromDisk(): void {
  if (benchLoaded) {
    return;
  }
  benchLoaded = true;
  benchRows.clear();
  try {
    const raw = readFileSync(benchSnapshotPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const now = benchNow();
    for (const [key, row] of Object.entries(parseBenchRows(parsed, now))) {
      benchRows.set(key, row);
    }
  } catch {
    return;
  }
}

function headerValue(headers: Headers | Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(name.toLowerCase()) ?? undefined;
  }
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return typeof direct === "string" ? direct : undefined;
}

function headerNumber(headers: Headers | Record<string, string> | undefined, name: string): number | undefined {
  const value = headerValue(headers, name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseGroqDurationMs(value: string, now: number): number | undefined {
  // Groq sends "2m59.56s" and sometimes just "7.66s" with no minute part.
  const match = /^(?:(\d+)m)?([\d.]+)s$/i.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return undefined;
  }
  return now + minutes * 60_000 + seconds * 1000;
}

function parseDelaySecondsMs(value: string, now: number): number | undefined {
  const trimmed = value.trim();
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return now + seconds * 1000;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRateLimitResetMs(value: string, now: number): number | undefined {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits === trimmed && digits.length >= 10) {
    const numeric = Number(digits);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    if (digits.length >= 13) {
      return numeric;
    }
  }
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      if (trimmed.length >= 13) {
        return numeric;
      }
      if (trimmed.length >= 10 && trimmed.length <= 12) {
        return numeric * 1000;
      }
    }
  }
  return parseDelaySecondsMs(trimmed, now);
}

function parseIsoOrUnix(value: unknown, now: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return value;
    }
    return value * 1000;
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && /^\d+(\.\d+)?$/.test(value.trim())) {
      return parseIsoOrUnix(asNumber, now);
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function walkJsonKeys(value: unknown, keys: Set<string>, found: Array<unknown>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkJsonKeys(item, keys, found);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key)) {
      found.push(child);
    }
    walkJsonKeys(child, keys, found);
  }
}

function readJsonClock(body: unknown, now: number): number | undefined {
  const hits: unknown[] = [];
  walkJsonKeys(body, new Set(["next_flush_time", "resets_at"]), hits);
  for (const hit of hits) {
    const parsed = parseIsoOrUnix(hit, now);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  if (isRecord(body) && isRecord(body.metadata) && isRecord(body.metadata.headers)) {
    const echoed = body.metadata.headers;
    const reset = echoed["x-ratelimit-reset"] ?? echoed["X-RateLimit-Reset"];
    if (typeof reset === "string") {
      const parsed = parseRateLimitResetMs(reset, now);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

function parseQuotaPair(headers: Headers | Record<string, string> | undefined, body: unknown, now: number): number | undefined {
  const remainingRequests = headerNumber(headers, "x-ratelimit-remaining-requests");
  const remainingTokens = headerNumber(headers, "x-ratelimit-remaining-tokens");
  if (remainingRequests !== 0 && remainingTokens !== 0) {
    if (remainingRequests !== undefined || remainingTokens !== undefined) {
      return undefined;
    }
  }
  const requestsZero = remainingRequests === 0;
  const tokensZero = remainingTokens === 0;
  if (!requestsZero && !tokensZero) {
    return undefined;
  }
  if (requestsZero) {
    const resetRequests = headerValue(headers, "x-ratelimit-reset-requests");
    if (resetRequests) {
      const duration = parseGroqDurationMs(resetRequests, now);
      if (duration !== undefined) {
        return duration;
      }
    }
  }
  if (tokensZero) {
    const resetTokens = headerValue(headers, "x-ratelimit-reset-tokens");
    if (resetTokens) {
      const duration = parseGroqDurationMs(resetTokens, now);
      if (duration !== undefined) {
        return duration;
      }
    }
  }
  return undefined;
}

function firstClockMs(
  status: number,
  headers: Headers | Record<string, string> | undefined,
  body: unknown,
  now: number
): { noProviderTime?: boolean; until?: number } {
  const retryAfter = headerValue(headers, "retry-after");
  if (retryAfter) {
    const parsed = parseDelaySecondsMs(retryAfter, now);
    if (parsed !== undefined) {
      return { until: parsed };
    }
  }
  const rateReset = headerValue(headers, "x-ratelimit-reset");
  if (rateReset) {
    const parsed = parseRateLimitResetMs(rateReset, now);
    if (parsed !== undefined) {
      return { until: parsed };
    }
  }
  const quotaUntil = parseQuotaPair(headers, body, now);
  if (quotaUntil !== undefined) {
    return { until: quotaUntil };
  }
  const jsonUntil = readJsonClock(body, now);
  if (jsonUntil !== undefined) {
    if (status === 403) {
      return { until: Math.floor(jsonUntil / 60_000) * 60_000 };
    }
    return { until: jsonUntil };
  }
  if (status === 429) {
    // shortcut: the provider sent no clock, replace this when a later response has one
    return { until: now + bench429NoClockMs, noProviderTime: true };
  }
  return {};
}

function setBenchRow(key: string, patch: BenchRow): void {
  const current = benchRows.get(key) ?? {};
  benchRows.set(key, { ...current, ...patch });
}

function removeRowsMatching(provider: string, credentialId: string, model: string): void {
  for (const key of [...benchRows.keys()]) {
    const [rowProvider, rowCredential, rowModel] = key.split("\0");
    if (rowProvider !== provider.trim()) {
      continue;
    }
    const credMatch = rowCredential === credentialId || rowCredential === "*" || credentialId === "*";
    const modelMatch = rowModel === model.trim() || rowModel === "*" || model === "*";
    if (credMatch && modelMatch) {
      benchRows.delete(key);
    }
  }
}

function logLegLine(parts: Record<string, string | number | undefined>): void {
  const tokens = Object.entries(parts)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`);
  const suffix = typeof parts.detail === "string" ? ` ${parts.detail}` : "";
  console.info(`[class-switch] leg ${tokens.filter((t) => !t.startsWith("detail=")).join(" ")}${suffix}`);
}

export async function recordClassRefusal(
  status: number,
  provider: string,
  model: string,
  credentialId = "*",
  headers?: Headers | Record<string, string>,
  body?: unknown
): Promise<void> {
  if (status === 400 || status === 402 || status === 408 || status === 409) {
    return;
  }
  loadBenchFromDisk();
  const now = benchNow();
  const slug = credentialId.trim() || "*";
  const modelId = model.trim();

  const quotaUntil = parseQuotaPair(headers, body, now);

  if (status === 429 || quotaUntil !== undefined) {
    const clock = quotaUntil !== undefined ? { until: quotaUntil } : firstClockMs(status, headers, body, now);
    const until = clock.until ?? now + bench429NoClockMs;
    const key = benchRowKey(provider, slug, modelId);
    setBenchRow(key, { until, probe: true });
    logLegLine({
      credential: slug,
      model: modelId,
      provider: provider.trim(),
      status,
      until: new Date(until).toISOString(),
      ...(clock.noProviderTime ? { detail: "no-provider-time" } : {})
    });
    await writeBenchSnapshot();
    return;
  }

  if (status === 401) {
    const clock = firstClockMs(status, headers, body, now);
    const until = clock.until ?? now + bench401Ms;
    const key = benchRowKey(provider, slug, "*");
    setBenchRow(key, { until, probe: true });
    logLegLine({ credential: slug, model: "*", provider: provider.trim(), status, until: new Date(until).toISOString() });
    await writeBenchSnapshot();
    return;
  }

  if (status === 403) {
    const clock = firstClockMs(status, headers, body, now);
    const key = benchRowKey(provider, slug, "*");
    if (clock.until !== undefined) {
      setBenchRow(key, { until: clock.until, probe: false });
      logLegLine({ credential: slug, model: "*", provider: provider.trim(), status, until: new Date(clock.until).toISOString() });
    } else {
      setBenchRow(key, { probe: false });
      console.info(`[class-switch] fix-key provider=${provider.trim()} credential=${slug} status=403`);
    }
    await writeBenchSnapshot();
    return;
  }

  if (status === 404) {
    const until = now + bench404Ms;
    const key = benchRowKey(provider, "*", modelId);
    setBenchRow(key, { until, probe: true });
    logLegLine({ credential: "*", model: modelId, provider: provider.trim(), status, until: new Date(until).toISOString() });
    await writeBenchSnapshot();
    return;
  }

  if (status >= 500) {
    const key = benchRowKey(provider, "*", modelId);
    setBenchRow(key, { until: now + bench5xxMs, probe: true });
    logLegLine({ credential: "*", model: modelId, provider: provider.trim(), status, until: new Date(now + bench5xxMs).toISOString() });
    await writeBenchSnapshot();
  }
}

export async function recordClassSuccess(
  provider: string,
  model: string,
  credentialId: string,
  input: { durationMs?: number; headers?: Headers | Record<string, string> }
): Promise<void> {
  loadBenchFromDisk();
  const now = benchNow();
  const slug = credentialId.trim();
  const modelId = model.trim();
  removeRowsMatching(provider.trim(), slug, modelId);
  const remainingRequests = headerNumber(input.headers, "x-ratelimit-remaining-requests");
  const remainingTokens = headerNumber(input.headers, "x-ratelimit-remaining-tokens");
  const resetRequests = headerValue(input.headers, "x-ratelimit-reset-requests");
  const resetDurationMs = resetRequests ? (parseGroqDurationMs(resetRequests, now) ?? undefined) : undefined;
  const sample: BenchRow = {
    confirmed: true,
    lastSuccessDurationMs: input.durationMs,
    remainingRequests,
    remainingTokens,
    resetDurationMs: resetDurationMs !== undefined ? resetDurationMs - now : undefined,
    sampledAt: now
  };
  const key = benchRowKey(provider, slug, modelId);
  if (remainingRequests === 0 || remainingTokens === 0) {
    const until = parseQuotaPair(input.headers, undefined, now) ?? now + bench429NoClockMs;
    setBenchRow(key, { ...sample, confirmed: false, until, probe: true });
  } else {
    setBenchRow(key, sample);
  }
  await writeBenchSnapshot();
}

function rowActive(row: BenchRow | undefined, now: number): boolean {
  if (!row) {
    return false;
  }
  // A 403 with no provider clock stores probe:false and no until: the bench
  // told the operator to fix that key, so it stays parked for routing
  // instead of spending a refusal on every later class request.
  if (row.probe === false && row.until === undefined) {
    return true;
  }
  return typeof row.until === "number" && row.until > now;
}

export function benchSortSignals(
  provider: string,
  model: string
): {
  confirmed: boolean;
  lastSuccessDurationMs?: number;
  remainingRequests?: number;
  remainingTokens?: number;
} {
  loadBenchFromDisk();
  const providerName = provider.trim();
  const modelId = model.trim();
  let confirmed = false;
  let remainingRequests: number | undefined;
  let remainingTokens: number | undefined;
  let lastSuccessDurationMs: number | undefined;
  for (const [key, row] of benchRows) {
    const [rowProvider, , rowModel] = key.split("\0");
    if (rowProvider !== providerName) {
      continue;
    }
    if (rowModel !== "*" && rowModel !== modelId) {
      continue;
    }
    if (row.confirmed) {
      confirmed = true;
    }
    if (row.remainingRequests !== undefined) {
      remainingRequests =
        remainingRequests === undefined ? row.remainingRequests : Math.max(remainingRequests, row.remainingRequests);
    }
    if (row.remainingTokens !== undefined) {
      remainingTokens =
        remainingTokens === undefined ? row.remainingTokens : Math.max(remainingTokens, row.remainingTokens);
    }
    if (row.lastSuccessDurationMs !== undefined) {
      lastSuccessDurationMs =
        lastSuccessDurationMs === undefined
          ? row.lastSuccessDurationMs
          : Math.min(lastSuccessDurationMs, row.lastSuccessDurationMs);
    }
  }
  return { confirmed, lastSuccessDurationMs, remainingRequests, remainingTokens };
}

export function isBenched(provider: string, model: string, credentialId?: string): boolean {
  loadBenchFromDisk();
  const now = benchNow();
  const providerName = provider.trim();
  const modelId = model.trim();
  for (const [key, row] of benchRows) {
    if (!rowActive(row, now)) {
      continue;
    }
    const [rowProvider, rowCredential, rowModel] = key.split("\0");
    if (rowProvider !== providerName) {
      continue;
    }
    if (rowModel !== "*" && rowModel !== modelId) {
      continue;
    }
    // An omitted credential id (model-level checks) matches only the wildcard
    // credential scope (404 and 5xx rows). A park stored for one credential —
    // a per-credential 429, or a 401 stored as that credential on model "*" —
    // must not remove the model for every other live credential; the callers
    // that check per slug keep doing that.
    if (rowCredential === "*" || (credentialId !== undefined && rowCredential === credentialId)) {
      return true;
    }
  }
  return false;
}

export function benchRowUntil(provider: string, credentialId: string, model: string): number | undefined {
  loadBenchFromDisk();
  const key = benchRowKey(provider, credentialId, model);
  const direct = benchRows.get(key);
  if (direct?.until !== undefined) {
    return direct.until;
  }
  if (model !== "*") {
    const wildcard = benchRows.get(benchRowKey(provider, credentialId, "*"));
    if (wildcard?.until !== undefined) {
      return wildcard.until;
    }
    const modelScope = benchRows.get(benchRowKey(provider, "*", model));
    return modelScope?.until;
  }
  return direct?.until;
}

export function benchProbeAllowedForTest(provider: string, credentialId: string): boolean {
  const row = benchRows.get(benchRowKey(provider, credentialId, "*"));
  return row?.probe !== false;
}

export function benchDueAtForTest(provider: string, model: string): number | undefined {
  return shelfDueMarks.get(`${provider}\0${model}`);
}

export function benchNextProbeAtForTest(provider: string, model: string): number | undefined {
  const rows = [...benchRows.values()];
  for (const row of rows) {
    if (row.nextProbeAt !== undefined) {
      return row.nextProbeAt;
    }
    if (typeof row.until === "number" && row.until > benchNow()) {
      return row.until;
    }
  }
  const key = benchRowKey(provider, "*", model);
  return benchRows.get(key)?.until ?? benchRows.get(benchRowKey(provider, "cred:n", model))?.until;
}

export function markShelfDueForTest(provider: string, model: string, dueAt: number): void {
  shelfDueMarks.set(`${provider}\0${model}`, dueAt);
}

export function setClassSwitchBenchNowForTest(now: () => number): void {
  benchOptions = { ...benchOptions, now };
}

export function resetClassSwitchBenchForTest(): void {
  benchRows.clear();
  benchLoaded = false;
  benchStartConfig = undefined;
  shelfDueMarks.clear();
  if (benchTimer) {
    clearTimeout(benchTimer);
    benchTimer = undefined;
  }
}

function providerCredentialApiKey(credential: ProviderCredentialConfig): string {
  return (credential.api_key || credential.apiKey || credential.apikey || "").trim();
}

function providerBaseUrl(provider: GatewayProviderConfig): string {
  return (provider.api_base_url || provider.baseUrl || provider.baseurl || "").trim();
}

function providerForName(config: AppConfig, providerName: string): GatewayProviderConfig | undefined {
  return config.Providers?.find((entry) => entry.name?.trim() === providerName.trim());
}

function shelfRows(snapshot = readShelfSnapshot()): ShelfRow[] {
  if (!snapshot) {
    return [];
  }
  return [
    ...snapshot.shelves.fable,
    ...snapshot.shelves.opus,
    ...snapshot.shelves.sonnet,
    ...snapshot.shelves.haiku
  ];
}

function largeRemainderSkip(row: BenchRow | undefined, now: number): boolean {
  if (!row || row.sampledAt === undefined) {
    return false;
  }
  const requests = row.remainingRequests;
  const tokens = row.remainingTokens;
  const insideReset = row.resetDurationMs !== undefined && now <= row.sampledAt + row.resetDurationMs;
  if (!insideReset) {
    return false;
  }
  if (requests !== undefined && requests > 10) {
    return true;
  }
  if (tokens !== undefined && tokens > 10_000) {
    return true;
  }
  return false;
}

function shouldProbeRow(provider: string, model: string, row: BenchRow | undefined, now: number): boolean {
  if (row?.probe === false) {
    return false;
  }
  if (largeRemainderSkip(row, now)) {
    return false;
  }
  if (typeof row?.until === "number" && row.until > now) {
    return false;
  }
  if (row?.confirmed) {
    return false;
  }
  const dueKey = `${provider}\0${model}`;
  const dueAt = shelfDueMarks.get(dueKey) ?? row?.dueAt;
  if (dueAt !== undefined && now < dueAt) {
    return false;
  }
  if (dueAt === undefined) {
    const offset = 60_000 + (Math.abs(dueKey.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 60_001);
    const scheduled = now + offset;
    shelfDueMarks.set(dueKey, scheduled);
    row ??= {};
    row.dueAt = scheduled;
    const credRow = benchRows.get(benchRowKey(provider, "*", model)) ?? {};
    benchRows.set(benchRowKey(provider, "*", model), { ...credRow, dueAt: scheduled });
    if (now < scheduled) {
      return false;
    }
  }
  return true;
}

function newestBenchRowFor(provider: string, model: string): BenchRow | undefined {
  const providerName = provider.trim();
  const modelId = model.trim();
  let newest: BenchRow | undefined;
  for (const [key, row] of benchRows) {
    const [rowProvider, , rowModel] = key.split("\0");
    if (rowProvider !== providerName || rowModel !== modelId) {
      continue;
    }
    if (newest === undefined || (row.sampledAt ?? -1) > (newest.sampledAt ?? -1)) {
      newest = row;
    }
  }
  return newest;
}

async function runBenchProbeTick(config: AppConfig): Promise<void> {
  // Load the saved bench before the first tick: after a restart the
  // in-memory map stays empty until a request touches it, and a tick that
  // skips loading can probe a credential whose saved row says probe:false.
  loadBenchFromDisk();
  const now = benchNow();
  const probe = benchOptions?.probeProvider ?? probeGatewayProvider;
  for (const providerRow of shelfRows()) {
    const health =
      newestBenchRowFor(providerRow.provider, providerRow.model) ??
      benchRows.get(benchRowKey(providerRow.provider, "*", providerRow.model));
    if (!shouldProbeRow(providerRow.provider, providerRow.model, health, now)) {
      continue;
    }
    const provider = providerForName(config, providerRow.provider);
    if (!provider) {
      continue;
    }
    const credentials = activeProviderCredentials(provider);
    const credential = credentials[0];
    if (!credential) {
      continue;
    }
    // Resolve the slug the same way every other bench consumer does: the
    // runtime id over the CONFIGURED credential list — the active list skips
    // disabled and keyless credentials, so its own index is not the
    // configured one — slugified. That is the exact slug the executor
    // records fix-key rows under; ProviderCredentialConfig has no
    // credentialId property, so the previous read always fell back to
    // "cred:0" and never matched a real row.
    const slug = providerCredentialSlug(providerCredentialRuntimeId(provider, credential));
    const fixKey = benchRows.get(benchRowKey(providerRow.provider, slug, "*"));
    if (fixKey?.probe === false && fixKey.until === undefined) {
      continue;
    }
    const apiKey = providerCredentialApiKey(credential);
    if (!apiKey) {
      continue;
    }
    try {
      await probe({
        apiKey,
        baseUrl: providerBaseUrl(provider),
        forceRefresh: true,
        mode: "connectivity",
        models: [providerRow.model]
      });
    } catch (error) {
      console.info(`[class-switch] bench probe failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function defaultBenchSchedule(delayMs: number, run: () => void | Promise<void>): void {
  if (benchTimer) {
    clearTimeout(benchTimer);
  }
  benchTimer = setTimeout(() => {
    benchTimer = undefined;
    void Promise.resolve(run());
  }, delayMs);
  benchTimer.unref?.();
}

function scheduleNextBenchTick(config: AppConfig): void {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  const schedule = benchOptions?.schedule ?? defaultBenchSchedule;
  schedule(benchProbePeriodMs, () => {
    void (async () => {
      const loaded = await (benchOptions?.loadConfig?.() ?? benchStartConfig ?? loadAppConfig());
      try {
        await runBenchProbeTick(loaded);
      } finally {
        scheduleNextBenchTick(loaded);
      }
    })();
  });
}

export function startBench(config: AppConfig, options: ClassSwitchBenchOptions = {}): void {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return;
  }
  benchStartConfig = config;
  benchOptions = { ...benchOptions, ...options };
  scheduleNextBenchTick(config);
}

export function stopBench(): void {
  if (benchTimer) {
    clearTimeout(benchTimer);
    benchTimer = undefined;
  }
}
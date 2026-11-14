import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import type { AppConfig, GatewayProviderProbeRequest } from "@ccr/core/contracts/app";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";

const bench5xxMs = 30_000;

type BenchRow = { until?: number };

const benchedModels = new Map<string, BenchRow>();
let benchLoaded = false;

function benchRowKey(provider: string, credentialId: string, model: string): string {
  return `${provider}\0${credentialId}\0${model}`;
}

export function benchSnapshotPath(): string {
  return pathResolve(resolveRuntimeDataDir(), "cache", "class-switch-bench.json");
}

function loadBenchFromDisk(): void {
  if (benchLoaded) {
    return;
  }
  benchLoaded = true;
  try {
    const raw = readFileSync(benchSnapshotPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return;
    }
    const now = Date.now();
    for (const [key, row] of Object.entries(parsed as Record<string, { until?: unknown }>)) {
      if (typeof row?.until === "number" && Number.isFinite(row.until) && row.until > now) {
        benchedModels.set(key, { until: row.until });
      }
    }
  } catch {
    return;
  }
}

async function writeBenchSnapshot(rows: Record<string, BenchRow>): Promise<void> {
  const file = benchSnapshotPath();
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporaryFile, JSON.stringify(rows), "utf8");
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

function activeBenchRows(): Record<string, BenchRow> {
  const now = Date.now();
  const rows: Record<string, BenchRow> = {};
  for (const [key, row] of benchedModels) {
    if (typeof row.until === "number" && row.until > now) {
      rows[key] = row;
    }
  }
  return rows;
}

export async function recordClassRefusal(
  status: number,
  provider: string,
  model: string,
  _credentialId?: string,
  _headers?: unknown,
  _body?: unknown
): Promise<void> {
  if (status < 500) {
    return;
  }
  loadBenchFromDisk();
  const key = benchRowKey(provider.trim(), "*", model.trim());
  benchedModels.set(key, { until: Date.now() + bench5xxMs });
  await writeBenchSnapshot(activeBenchRows());
}

export async function recordClassSuccess(): Promise<void> {}
export function startBench(_config: AppConfig): void {}
export function stopBench(): void {}

export function benchRowUntil(): undefined {
  return undefined;
}
export function benchProbeAllowedForTest(): boolean {
  return true;
}
export function benchDueAtForTest(): undefined {
  return undefined;
}
export function benchNextProbeAtForTest(): undefined {
  return undefined;
}
export function markShelfDueForTest(): void {}
export function setClassSwitchBenchNowForTest(): void {}
export function resetClassSwitchBenchForTest(): void {
  benchedModels.clear();
  benchLoaded = false;
}

export function isBenched(provider: string, model: string): boolean {
  loadBenchFromDisk();
  const legacyKey = `${provider}\0${model}`;
  const legacy = benchedModels.get(legacyKey);
  if (legacy && typeof legacy.until === "number" && legacy.until > Date.now()) {
    return true;
  }
  for (const [key, row] of benchedModels) {
    if (!key.startsWith(`${provider}\0`)) {
      continue;
    }
    if (key.endsWith(`\0${model}`) && typeof row.until === "number" && row.until > Date.now()) {
      return true;
    }
  }
  return false;
}

export type ClassSwitchBenchOptions = {
  loadConfig?: () => Promise<AppConfig>;
  probeProvider?: (request: GatewayProviderProbeRequest) => Promise<unknown>;
  schedule?: (delayMs: number, run: () => void | Promise<void>) => void;
  now?: () => number;
};
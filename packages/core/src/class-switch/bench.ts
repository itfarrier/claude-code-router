import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
import { resolveRuntimeDataDir } from "@ccr/core/runtime/app-paths";

const bench5xxMs = 30_000;

type BenchRow = { until: number };

const benchedModels = new Map<string, BenchRow>();
let benchLoaded = false;

function benchRowKey(provider: string, model: string): string {
  return `${provider}\0${model}`;
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
    if (row.until > now) {
      rows[key] = row;
    }
  }
  return rows;
}

export async function recordClassRefusal(status: number, provider: string, model: string): Promise<void> {
  if (status < 500) {
    return;
  }
  loadBenchFromDisk();
  const key = benchRowKey(provider.trim(), model.trim());
  benchedModels.set(key, { until: Date.now() + bench5xxMs });
  await writeBenchSnapshot(activeBenchRows());
}

export function isBenched(provider: string, model: string): boolean {
  loadBenchFromDisk();
  const key = benchRowKey(provider, model);
  const row = benchedModels.get(key);
  if (!row) {
    return false;
  }
  if (row.until <= Date.now()) {
    benchedModels.delete(key);
    return false;
  }
  return true;
}
import { readFileSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve as pathResolve } from "node:path";
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
};

export type ClassifyResult =
  | { kind: "shelf"; class: ShelfClass; score: number }
  | { kind: "excluded"; reason: "no-index" };

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

export function classForScore(score: number, presentIndexCount = 3): ShelfClass | undefined {
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

export function classifyModel(input: ClassifyInput): ClassifyResult {
  const score = scoreArtificialAnalysis(input.artificialAnalysis);
  if (score === undefined) {
    return { kind: "excluded", reason: "no-index" };
  }
  const presentCount = ["coding_index", "agentic_index", "intelligence_index"].filter((key) =>
    finiteIndex(input.artificialAnalysis?.[key as keyof ArtificialAnalysisIndexes]) !== undefined
  ).length;
  const shelfClass = classForScore(score, presentCount);
  if (!shelfClass) {
    return { kind: "excluded", reason: "no-index" };
  }
  return { kind: "shelf", class: shelfClass, score };
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
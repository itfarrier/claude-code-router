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
  id?: string;
  canonical_slug?: string;
  benchmarks?: { artificial_analysis?: ArtificialAnalysisIndexes };
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

function presentIndexCount(indexes: ArtificialAnalysisIndexes | undefined): number {
  return (["coding_index", "agentic_index", "intelligence_index"] as const).filter(
    (key) => finiteIndex(indexes?.[key]) !== undefined
  ).length;
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

function shelfFromTierOnly(tierClasses: ShelfClass[]): ClassifyResult {
  if (!tierClasses.length) {
    return { kind: "excluded", reason: "no-index" };
  }
  if (tierClasses.length === 1) {
    const tierClass = tierClasses[0];
    return { kind: "shelf", class: tierClass, tierClass };
  }
  const higher = tierClasses.reduce((left, right) => higherShelfClass(left, right));
  const lower = tierClasses.find((tier) => tier !== higher) ?? higher;
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
  const tierClasses = tierClassesFromModelId(input.model);
  const score = scoreArtificialAnalysis(input.artificialAnalysis);
  const presentCount = presentIndexCount(input.artificialAnalysis);

  if (score === undefined) {
    return shelfFromTierOnly(tierClasses);
  }

  const scoreClass = classForScore(score, presentCount);
  if (!scoreClass) {
    return shelfFromTierOnly(tierClasses);
  }

  if (!tierClasses.length) {
    return { kind: "shelf", class: scoreClass, score };
  }

  const tierClass = tierClasses[0];
  const distance = classDistance(scoreClass, tierClass);
  if (distance <= 1) {
    return { kind: "shelf", class: scoreClass, score, tierClass };
  }

  return { kind: "shelf", class: scoreClass, score, tierClass };
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
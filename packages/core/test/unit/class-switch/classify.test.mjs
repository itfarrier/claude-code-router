import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  classifyModel,
  classForScore,
  matchOpenRouterModel,
  readShelfSnapshot,
  refreshClassShelves,
  scoreArtificialAnalysis,
  seedShelvesFromConfig,
  shelfSnapshotPath,
  startClassSwitchCatalog,
  stopClassSwitchCatalog
} from "@ccr/core/class-switch/catalog.ts";
import { providerModelAutoRefreshIntervalMs } from "@ccr/core/providers/model-auto-refresh.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

function classify(provider, model, artificialAnalysis, extra = {}) {
  return classifyModel({ provider, model, artificialAnalysis, ...extra });
}

test("command-a-plus scores within 1e-9 of 15.44 and is haiku", () => {
  const score = scoreArtificialAnalysis({
    agentic_index: 1,
    coding_index: 27.8,
    intelligence_index: 6.2
  });
  assert.ok(Math.abs((score ?? 0) - 15.44) < 1e-9);
  const result = classify("cohere", "command-a-plus", {
    agentic_index: 1,
    coding_index: 27.8,
    intelligence_index: 6.2
  });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "haiku");
  assert.ok(Math.abs((result.score ?? 0) - 15.44) < 1e-9);
});

test("motif-3 scores within 1e-9 of 50.3375 and is opus", () => {
  const score = scoreArtificialAnalysis({
    agentic_index: 28.4,
    coding_index: 63.5,
    intelligence_index: null
  });
  assert.ok(Math.abs((score ?? 0) - 50.3375) < 1e-9);
  const result = classify("motif-technologies", "motif-3", {
    agentic_index: 28.4,
    coding_index: 63.5,
    intelligence_index: null
  });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "opus");
});

test("exact score cuts 62, 50, and 28 land on fable, opus, and sonnet", () => {
  assert.equal(classForScore(62, 2), "fable");
  assert.equal(classForScore(50, 2), "opus");
  assert.equal(classForScore(28, 2), "sonnet");
  const fableIndexes = { agentic_index: 63, coding_index: 63, intelligence_index: 63 };
  const opusIndexes = { agentic_index: 50, coding_index: 50, intelligence_index: 50 };
  const sonnetIndexes = { agentic_index: 28, coding_index: 28, intelligence_index: 28 };
  assert.ok(scoreArtificialAnalysis(fableIndexes) >= 62);
  assert.ok(scoreArtificialAnalysis(opusIndexes) >= 50 && scoreArtificialAnalysis(opusIndexes) < 62);
  assert.ok(scoreArtificialAnalysis(sonnetIndexes) >= 28 && scoreArtificialAnalysis(sonnetIndexes) < 50);
  assert.equal(classify("p", "fixture", fableIndexes).class, "fable");
  assert.equal(classify("p", "fixture", opusIndexes).class, "opus");
  assert.equal(classify("p", "fixture", sonnetIndexes).class, "sonnet");
});

test("score boundaries 61.9, 49.9, and 27.9 land on opus, sonnet, and haiku", () => {
  assert.equal(classify("p", "m", { coding_index: 61.9, agentic_index: 61.9 }).class, "opus");
  assert.equal(classify("p", "m", { coding_index: 49.9, agentic_index: 49.9 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 27.9, agentic_index: 27.9 }).class, "haiku");
});

test("one-index cap places 62 and 53.9 on sonnet, 28 on sonnet, 27 on haiku", () => {
  assert.equal(classify("p", "m", { coding_index: 62 }).class, "sonnet");
  assert.equal(classify("p", "m", { intelligence_index: 53.9 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 28 }).class, "sonnet");
  assert.equal(classify("p", "m", { coding_index: 27 }).class, "haiku");
});

test("one present index of 40 returns sonnet and score equals 40", () => {
  const result = classify("p", "m", { coding_index: 40 });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "sonnet");
  assert.equal(result.score, 40);
});

test("null, missing, NaN, and Infinity indexes are not present", () => {
  assert.equal(classify("p", "m", {}).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: null }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: Number.NaN }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: Number.POSITIVE_INFINITY }).kind, "excluded");
  assert.equal(classify("p", "m", { coding_index: "40" }).kind, "excluded");
});

test("tier tokens are whole tokens only and case-insensitive", () => {
  const consoleResult = classify("p", "console-model", undefined);
  assert.equal(consoleResult.kind, "excluded");
  assert.equal(consoleResult.reason, "no-index");

  assert.equal(classify("p", "my-fable-model", undefined).class, "fable");
  assert.equal(classify("p", "ASTRA-9", undefined).class, "fable");
  assert.equal(classify("p", "gpt-5.6-sol", undefined).class, "opus");
  assert.equal(classify("p", "terra-lite", undefined).class, "sonnet");
  assert.equal(classify("p", "luna-nano", undefined).class, "haiku");
});

test("flash, mini, nano, and lite do not set a class", () => {
  const result = classify("inclusionai", "ling-3.2-flash:free", undefined);
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "no-index");
});

test("gpt-5.6-sol with no indexes is opus", () => {
  const result = classify("openai", "gpt-5.6-sol", undefined);
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "opus");
  assert.equal(result.tierClass, "opus");
  assert.equal(result.score, undefined);
});

test("two tier classes one step apart with no score shelf the higher class", () => {
  const result = classify("p", "fable-opus-bridge", undefined);
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "fable");
  assert.equal(result.score, undefined);
});

test("three tier classes without score review regardless of token order", () => {
  const forward = classify("p", "fable-opus-haiku", undefined);
  assert.equal(forward.kind, "review");
  assert.equal(forward.reason, "score-tier-disagree");
  const reverse = classify("p", "haiku-fable-opus", undefined);
  assert.equal(reverse.kind, "review");
  assert.equal(reverse.reason, "score-tier-disagree");
});

test("readShelfSnapshot rejects null excluded or review entries", async () => {
  await withShelfTempDir(() => {
  const file = shelfSnapshotPath();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        excluded: [null],
        review: [],
        shelves: { fable: [], haiku: [], opus: [], sonnet: [] }
      })
    );
    assert.equal(readShelfSnapshot(), undefined);
    writeFileSync(
      file,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        excluded: [],
        review: [null],
        shelves: { fable: [], haiku: [], opus: [], sonnet: [] }
      })
    );
    assert.equal(readShelfSnapshot(), undefined);
  });
});

test("hex id abcdef0123456789 with score 62 is fable", () => {
  const scored = classify("p", "abcdef0123456789", {
    agentic_index: 63,
    coding_index: 63,
    intelligence_index: 63
  });
  assert.equal(scored.kind, "shelf");
  assert.equal(scored.class, "fable");
  const bare = classify("p", "abcdef0123456789", undefined);
  assert.equal(bare.kind, "excluded");
  assert.equal(bare.reason, "no-index");
});

test("matchOpenRouterModel uses id or canonical_slug with case insensitivity", () => {
  const rows = [
    { id: "OpenAI/GPT-5", canonical_slug: "openai/gpt-5" },
    { id: "other/x", canonical_slug: "other/x" }
  ];
  assert.deepEqual(matchOpenRouterModel("openai/gpt-5", rows)?.id, "OpenAI/GPT-5");
  assert.equal(matchOpenRouterModel("openai/gpt-5", [...rows, { id: "openai/gpt-5", canonical_slug: "dup" }]), undefined);
});

test("matchOpenRouterModel final segment rule applies only without a slash", () => {
  const rows = [
    { id: "a/foo", canonical_slug: "a/foo" },
    { id: "b/foo", canonical_slug: "b/foo" }
  ];
  assert.equal(matchOpenRouterModel("foo", rows), undefined);
  assert.deepEqual(matchOpenRouterModel("foo", [rows[0]])?.id, "a/foo");
  assert.deepEqual(matchOpenRouterModel("a/foo", rows)?.id, "a/foo");
});

test("gemini-4-hydrogen batch is excluded", () => {
  const result = classify("google", "gemini-4-hydrogen:batch", { intelligence_index: 53.9 });
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "batch");
});

test("batch colon segments are case-insensitive and do not match batcher", () => {
  assert.equal(classify("p", "foo:BATCH", { coding_index: 70 }).reason, "batch");
  assert.equal(classify("p", "foo:batch:free", { coding_index: 70 }).reason, "batch");
  assert.notEqual(classify("p", "foo:batcher", { coding_index: 70 }).reason, "batch");
  assert.equal(classify("p", "foo:free", { coding_index: 70 }).kind, "shelf");
});

test("batch wins over embed token and score", () => {
  const result = classify("p", "text-embedding:batch", { coding_index: 80 });
  assert.equal(result.reason, "batch");
});

test("non-text output modalities and architecture exclude models", () => {
  assert.equal(
    classify("p", "image-only", undefined, { outputModalities: ["image"] }).reason,
    "non-text"
  );
  assert.equal(classify("p", "empty-out", undefined, { outputModalities: [] }).reason, "non-text");
  assert.equal(
    classify("p", "diagram", undefined, { architectureModality: "text+image->image" }).reason,
    "non-text"
  );
  assert.equal(classify("p", "normal", undefined, { architectureModality: "text->text" }).kind, "excluded");
});

test("text-only vision output stays eligible", () => {
  const result = classify("p", "vision-chat", undefined, {
    architectureModality: "text+image->text",
    outputModalities: ["text"]
  });
  assert.equal(result.kind, "excluded");
  assert.equal(result.reason, "no-index");
});

test("embed and moderation id tokens are non-text", () => {
  assert.equal(classify("p", "openai-text-embedding-3", undefined).reason, "non-text");
  assert.equal(classify("p", "openai-text-EMBEDDING-3", undefined).reason, "non-text");
  assert.notEqual(classify("p", "textembeddingservice", undefined).reason, "non-text");
});

test("gemini hydride one-index opus token shelves sonnet", () => {
  const result = classify("google", "gemini-4-hydrogen-opus", { intelligence_index: 53.9 });
  assert.equal(result.kind, "shelf");
  assert.equal(result.class, "sonnet");
});

test("gemini hydride one-index fable token waits in review", () => {
  const result = classify("google", "gemini-4-hydrogen-fable", { intelligence_index: 53.9 });
  assert.equal(result.kind, "review");
  assert.equal(result.reason, "score-tier-disagree");
  assert.equal(result.scoreClass, "sonnet");
  assert.equal(result.tierClass, "fable");
  assert.notEqual(result.kind, "shelf");
});

function benchRefreshConfig() {
  return {
    Providers: [
      {
        api_base_url: "https://bench.provider/v1",
        api_key: "sk-bench-test-key",
        models: ["gpt-5.6-sol", "stale-model"],
        modelMetadata: {
          "gpt-5.6-sol": { contextWindow: 1_000_000 }
        },
        name: "BenchProvider",
        type: "openai_chat_completions"
      }
    ],
    profile: { enabled: true, profiles: [] },
    virtualModelProfiles: []
  };
}

function benchConfigWithModels(models) {
  const config = benchRefreshConfig();
  config.Providers[0].models = models;
  return config;
}

async function withShelfTempDir(run) {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-class-shelf-refresh-"));
  try {
    process.env.CCR_INTERNAL_USER_DATA_DIR = dir;
    await run(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
    if (previousDataDir === undefined) {
      delete process.env.CCR_INTERNAL_USER_DATA_DIR;
    } else {
      process.env.CCR_INTERNAL_USER_DATA_DIR = previousDataDir;
    }
  }
}

function opusOneMillionPlan(config) {
  const registry = new ModelRegistry({
    Providers: config.Providers,
    virtualModelProfiles: config.virtualModelProfiles ?? []
  });
  return createRouteExecutionPlan({
    bodyModel: "opus[1m]",
    fallback: { mode: "off", models: [], retryCount: 0 },
    hasRequestBody: true,
    modelRegistry: registry,
    primaryModel: "opus[1m]"
  });
}

test("failed score GET keeps prior shelf rows and scores", async () => {
  const config = benchRefreshConfig();
  await withShelfTempDir(async () => {
    await refreshClassShelves(config, {
      fetchScores: async () => ({
        ok: true,
        rows: [
          {
            benchmarks: { artificial_analysis: { agentic_index: 70, coding_index: 70, intelligence_index: 70 } },
            id: "gpt-5.6-sol"
          }
        ]
      }),
      probeProvider: async () => ({
        capabilities: [],
        models: ["gpt-5.6-sol"],
        normalizedBaseUrl: "https://bench.provider/v1",
        protocols: []
      })
    });
    const scored = readShelfSnapshot()?.shelves.fable.find((row) => row.model === "gpt-5.6-sol");
    assert.ok(scored?.score);

    await refreshClassShelves(config, {
      fetchScores: async () => ({ ok: false, rows: [] }),
      probeProvider: async () => ({
        capabilities: [],
        models: ["gpt-5.6-sol", "brand-new-model"],
        normalizedBaseUrl: "https://bench.provider/v1",
        protocols: []
      })
    });
    const snapshot = readShelfSnapshot();
    const kept = snapshot?.shelves.fable.find((row) => row.model === "gpt-5.6-sol");
    assert.ok(kept?.score);
    assert.equal(snapshot?.excluded.some((row) => row.model === "gpt-5.6-sol"), false);
    assert.equal(snapshot?.excluded.some((row) => row.model === "brand-new-model"), true);
  });
});

test("catalog refresh excludes OpenRouter image-output models", async () => {
  const config = benchRefreshConfig();
  await withShelfTempDir(async () => {
    await refreshClassShelves(config, {
      fetchScores: async () => ({
        ok: true,
        rows: [
          {
            architecture: { modality: "text->image", output_modalities: ["image"] },
            benchmarks: { artificial_analysis: { agentic_index: 70, coding_index: 70, intelligence_index: 70 } },
            id: "gpt-image-1"
          }
        ]
      }),
      probeProvider: async () => ({
        capabilities: [],
        models: ["gpt-image-1"],
        normalizedBaseUrl: "https://bench.provider/v1",
        protocols: []
      })
    });
    const snapshot = readShelfSnapshot();
    const row = snapshot?.excluded.find((entry) => entry.model === "gpt-image-1");
    assert.equal(row?.reason, "non-text");
    assert.equal(snapshot?.shelves.fable.some((entry) => entry.model === "gpt-image-1"), false);
  });
});

test("catalog refresh drops a missing model and keeps a failed provider", async () => {
  const config = benchRefreshConfig();
  await withShelfTempDir(async () => {
    await seedShelvesFromConfig(config);
    const seeded = readShelfSnapshot();
    const seededOpus = seeded?.shelves.opus.find((row) => row.model === "gpt-5.6-sol");
    assert.equal(seededOpus?.contextWindow, 1_000_000);

    let plan = opusOneMillionPlan(config);
    assert.equal(plan.attempts[0]?.model, "BenchProvider/gpt-5.6-sol");

    await refreshClassShelves(config, {
      probeProvider: async () => {
        throw new Error("probe failed");
      }
    });
    const afterThrow = readShelfSnapshot();
    const kept = afterThrow?.shelves.opus.find((row) => row.model === "gpt-5.6-sol");
    assert.equal(kept?.contextWindow, 1_000_000);
    plan = opusOneMillionPlan(config);
    assert.equal(plan.attempts[0]?.model, "BenchProvider/gpt-5.6-sol");

    const probeCalls = [];
    await refreshClassShelves(config, {
      fetchScores: async () => ({
        ok: true,
        rows: [{ benchmarks: { artificial_analysis: { intelligence_index: 53.9 } }, id: "google/gemini-4-fable" }]
      }),
      probeProvider: async (request) => {
        probeCalls.push(request);
        return {
          capabilities: [],
          models: ["gpt-5.6-sol", "google/gemini-4-fable"],
          normalizedBaseUrl: request.baseUrl,
          protocols: []
        };
      }
    });
    assert.equal(probeCalls.length, 1);
    assert.equal(probeCalls[0].mode, "models");
    assert.equal(probeCalls[0].forceRefresh, true);
    assert.equal(JSON.stringify(probeCalls[0]).includes("ping"), false);

    const snapshot = readShelfSnapshot();
    assert.ok(snapshot);
    assert.equal(snapshot.shelves.opus.some((row) => row.model === "stale-model"), false);
    const reviewRow = snapshot.review.find((row) => row.model === "google/gemini-4-fable");
    assert.equal(reviewRow?.reason, "score-tier-disagree");
    for (const shelfClass of ["fable", "opus", "sonnet", "haiku"]) {
      assert.equal(snapshot.shelves[shelfClass].some((row) => row.model === "google/gemini-4-fable"), false);
    }
    const solRow = snapshot.shelves.opus.find((row) => row.model === "gpt-5.6-sol");
    assert.equal(solRow?.contextWindow, 1_000_000);
    plan = opusOneMillionPlan(config);
    assert.equal(plan.attempts[0]?.model, "BenchProvider/gpt-5.6-sol");

    const snapshotText = readFileSync(shelfSnapshotPath(), "utf8");
    assert.equal(snapshotText.includes("sk-bench-test-key"), false);
    assert.deepEqual(config.Providers[0].models, ["gpt-5.6-sol", "stale-model"]);
  });
});

test("config save during shelf refresh runs follow-up pass with newer snapshot", async () => {
  const loads = [];
  let configTag = "initial";
  const initialConfig = benchConfigWithModels(["stale-marker"]);
  const savedConfig = benchConfigWithModels(["fresh-marker"]);

  let probePasses = 0;
  let unblockFirstProbe;
  const firstProbeBlocked = new Promise((resolve) => {
    unblockFirstProbe = resolve;
  });

  const catalogOptions = {
    fetchScores: async () => ({ ok: true, rows: [] }),
    loadConfig: async () => {
      loads.push(configTag);
      return configTag === "initial" ? initialConfig : savedConfig;
    },
    probeProvider: async () => {
      probePasses += 1;
      if (probePasses === 1) {
        await firstProbeBlocked;
      }
      const models = (configTag === "initial" ? initialConfig : savedConfig).Providers[0].models;
      return { capabilities: [], models, protocols: [] };
    },
    schedule(delayMs, run) {
      if (delayMs !== 0) {
        return;
      }
      queueMicrotask(() => void run());
    }
  };

  await withShelfTempDir(async () => {
    startClassSwitchCatalog(initialConfig, catalogOptions);

    while (probePasses < 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    configTag = "saved";
    startClassSwitchCatalog(savedConfig, catalogOptions);
    unblockFirstProbe();

    const deadline = Date.now() + 5_000;
    while (loads.length < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.ok(loads.length >= 2, "expected a follow-up refresh after config save during walk");
    assert.ok(loads.includes("saved"), "follow-up refresh must load saved config");

    const snapshot = readShelfSnapshot();
    assert.ok(snapshot);
    const rows = [
      ...snapshot.shelves.fable,
      ...snapshot.shelves.opus,
      ...snapshot.shelves.sonnet,
      ...snapshot.shelves.haiku,
      ...snapshot.excluded
    ];
    assert.equal(rows.some((row) => row.model === "fresh-marker"), true);
    assert.equal(rows.some((row) => row.model === "stale-marker"), false);
    stopClassSwitchCatalog();
  });
});

test("catalog walk reloads config on each tick", async () => {
  const loads = [];
  const config = benchRefreshConfig();
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  await withShelfTempDir(async () => {
    startClassSwitchCatalog(config, {
      fetchScores: async () => ({ ok: true, rows: [] }),
      loadConfig: async () => {
        loads.push(1);
        return config;
      },
      probeProvider: async () => ({ capabilities: [], models: ["gpt-5.6-sol"], protocols: [] }),
      schedule(delayMs, run) {
        if (delayMs === 0) {
          void run().then(() => resolveDone());
        }
      }
    });
    await done;
    assert.equal(loads.length, 1);
    stopClassSwitchCatalog();
  });
});

test("class switch catalog schedules zero then the provider refresh interval", async () => {
  const delays = [];
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const config = benchRefreshConfig();
  await withShelfTempDir(async () => {
    startClassSwitchCatalog(config, {
      fetchScores: async () => ({ ok: true, rows: [] }),
      probeProvider: async () => ({ capabilities: [], models: ["gpt-5.6-sol"], protocols: [] }),
      schedule(delayMs, run) {
        delays.push(delayMs);
        if (delays.length === 1) {
          void run().then(() => resolveDone());
        }
      }
    });
    await done;
    assert.deepEqual(delays, [0, providerModelAutoRefreshIntervalMs]);
    stopClassSwitchCatalog();
  });
});

test("CCR_CLASS_SWITCH=0 does not schedule the shelf catalog walk", () => {
  const previous = process.env.CCR_CLASS_SWITCH;
  const delays = [];
  try {
    process.env.CCR_CLASS_SWITCH = "0";
    startClassSwitchCatalog(benchRefreshConfig(), {
      schedule(delayMs) {
        delays.push(delayMs);
      }
    });
    assert.equal(delays.length, 0);
  } finally {
    if (previous === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previous;
    }
    stopClassSwitchCatalog();
  }
});

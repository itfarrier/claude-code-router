import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { classifyModel, shelfSnapshotPath, writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

function benchRegistry(extraProviders = []) {
  return new ModelRegistry({
    Providers: [
      { models: ["motif-technologies/motif-3"], name: "BenchProvider" },
      ...extraProviders
    ],
    virtualModelProfiles: []
  });
}

function classPlan(bodyModel, registry, overrides = {}) {
  return createRouteExecutionPlan({
    bodyModel,
    fallback: { mode: "off", models: [], retryCount: 0 },
    hasRequestBody: true,
    modelRegistry: registry,
    primaryModel: bodyModel,
    ...overrides
  });
}

async function withShelfDataDir(run) {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-class-switch-test-"));
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

test("claude-opus opens the scored opus shelf", async () => {
  await withShelfDataDir(async () => {
    const classified = classifyModel({
      provider: "BenchProvider",
      model: "motif-technologies/motif-3",
      artificialAnalysis: {
        agentic_index: 28.4,
        coding_index: 63.5,
        intelligence_index: null
      }
    });
    assert.equal(classified?.kind, "shelf");
    assert.equal(classified?.class, "opus");
    assert.ok(Math.abs((classified?.score ?? 0) - 50.3375) < 1e-9);

    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          {
            model: "motif-technologies/motif-3",
            provider: "BenchProvider",
            score: classified.score
          }
        ]
      },
      updatedAt: new Date().toISOString()
    });

    const plan = classPlan("claude-opus-4-6", benchRegistry());
    assert.equal(plan.attempts.length, 1);
    assert.equal(plan.attempts[0].model, "BenchProvider/motif-technologies/motif-3");
    assert.equal(plan.attempts[0].target?.kind, "provider");
    assert.equal(plan.attempts[0].target?.model, "motif-technologies/motif-3");
    assert.equal(plan.primaryModel, "claude-opus-4-6");
  });
});

test("best opens the opus shelf", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "motif-technologies/motif-3", provider: "BenchProvider", score: 50.5 }]
      },
      updatedAt: new Date().toISOString()
    });
    const plan = classPlan("best", benchRegistry());
    assert.equal(plan.attempts[0]?.model, "BenchProvider/motif-technologies/motif-3");
  });
});

test("locked class families open their shelves", async () => {
  await withShelfDataDir(async () => {
    const registry = new ModelRegistry({
      Providers: [
        { models: ["fable-model"], name: "FableP" },
        { models: ["sonnet-model"], name: "SonnetP" },
        { models: ["haiku-model"], name: "HaikuP" }
      ],
      virtualModelProfiles: []
    });
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        fable: [{ model: "fable-model", provider: "FableP", score: 70 }],
        haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }],
        opus: [{ model: "motif-technologies/motif-3", provider: "BenchProvider", score: 50.5 }],
        sonnet: [{ model: "sonnet-model", provider: "SonnetP", score: 35 }]
      },
      updatedAt: new Date().toISOString()
    });
    assert.equal(classPlan("claude-fable-5", registry).attempts[0]?.model, "FableP/fable-model");
    assert.equal(classPlan("claude-sonnet-4-6", registry).attempts[0]?.model, "SonnetP/sonnet-model");
    assert.equal(classPlan("claude-haiku-4-5", registry).attempts[0]?.model, "HaikuP/haiku-model");
    assert.equal(
      classPlan("Claude-Opus-4-6", benchRegistry()).attempts[0]?.model,
      "BenchProvider/motif-technologies/motif-3"
    );
  });
});

test("opusplan best-model and bare opus keep the parent attempt list", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "motif-technologies/motif-3", provider: "BenchProvider", score: 50 }]
      },
      updatedAt: new Date().toISOString()
    });
    const registry = benchRegistry();
    for (const bodyModel of ["claude-opusplan", "best-model", "opus"]) {
      const plan = classPlan(bodyModel, registry);
      assert.equal(plan.attempts.length, 1);
      assert.equal(plan.attempts[0].model, bodyModel);
      assert.equal(plan.attempts[0].target, undefined);
    }
  });
});

test("opus and sonnet one-million suffix filters context window", async () => {
  await withShelfDataDir(async () => {
    const registry = new ModelRegistry({
      Providers: [
        { models: ["wide", "narrow"], name: "OpusP" },
        { models: ["wide", "narrow"], name: "SonnetP" }
      ],
      virtualModelProfiles: []
    });
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        fable: [],
        haiku: [],
        opus: [
          { contextWindow: 1_000_000, model: "wide", provider: "OpusP", score: 55 },
          { contextWindow: 999_999, model: "narrow", provider: "OpusP", score: 54 }
        ],
        sonnet: [
          { contextWindow: 1_000_000, model: "wide", provider: "SonnetP", score: 35 },
          { contextWindow: Number.NaN, model: "narrow", provider: "SonnetP", score: 34 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    assert.deepEqual(
      classPlan("opus[1m]", registry).attempts.map((attempt) => attempt.model),
      ["OpusP/wide"]
    );
    assert.deepEqual(
      classPlan("sonnet[1m]", registry).attempts.map((attempt) => attempt.model),
      ["SonnetP/wide"]
    );
    assert.equal(classPlan("best[1m]", registry).attempts[0]?.model, "OpusP/wide");
    assert.equal(classPlan("opus[1m]", registry).attempts.length, 1);
    const parentOnly = classPlan("opus[1m]", registry);
    assert.equal(parentOnly.attempts[0].model, "OpusP/wide");
  });
});

test("hex gateway route ids open the decoded opus class", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "motif-technologies/motif-3", provider: "BenchProvider", score: 50 }]
      },
      updatedAt: new Date().toISOString()
    });
    const hex = Buffer.from("claude-opus-4-6", "utf8").toString("hex");
    const routeA = `anthropic/claude-ccr-h${hex}`;
    const routeB = `anthropic/claude-ccr7-h${hex}`;
    const registry = benchRegistry();
    assert.equal(classPlan(routeA, registry).attempts[0]?.model, "BenchProvider/motif-technologies/motif-3");
    assert.equal(classPlan(routeB, registry).attempts[0]?.model, "BenchProvider/motif-technologies/motif-3");
    const hex1m = Buffer.from("claude-opus-4-6", "utf8").toString("hex");
    const route1m = `anthropic/claude-ccr-h${hex1m}[1m]`;
    const registry1m = new ModelRegistry({
      Providers: [{ models: ["narrow", "wide"], name: "OpusP" }],
      virtualModelProfiles: []
    });
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { contextWindow: 999_999, model: "narrow", provider: "OpusP", score: 55 },
          { contextWindow: 1_000_000, model: "wide", provider: "OpusP", score: 54 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    assert.equal(classPlan(route1m, registry1m).attempts[0]?.model, "OpusP/wide");
  });
});

test("CCR_CLASS_SWITCH=0 keeps parent attempts with a valid shelf snapshot", async () => {
  const previousSwitch = process.env.CCR_CLASS_SWITCH;
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "motif-technologies/motif-3", provider: "BenchProvider", score: 50 }]
      },
      updatedAt: new Date().toISOString()
    });
    try {
      process.env.CCR_CLASS_SWITCH = "0";
      const plan = classPlan("claude-opus-4-6", benchRegistry());
      assert.equal(plan.attempts[0].model, "claude-opus-4-6");
      assert.equal(plan.attempts[0].target, undefined);
    } finally {
      if (previousSwitch === undefined) {
        delete process.env.CCR_CLASS_SWITCH;
      } else {
        process.env.CCR_CLASS_SWITCH = previousSwitch;
      }
    }
  });
});

test("empty corrupt and partial shelves keep or narrow parent attempts", async () => {
  await withShelfDataDir(async (dir) => {
    const registry = new ModelRegistry({
      Providers: [{ models: ["only"], name: "Alpha" }],
      virtualModelProfiles: []
    });
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { ...emptyShelves(), opus: [] },
      updatedAt: new Date().toISOString()
    });
    let plan = classPlan("best", registry);
    assert.equal(plan.attempts[0].model, "best");

    writeFileSync(shelfSnapshotPath(), "{not-json", "utf8");
    plan = classPlan("best", registry);
    assert.equal(plan.attempts[0].model, "best");

    writeFileSync(shelfSnapshotPath(), JSON.stringify({ bad: true }), "utf8");
    plan = classPlan("best", registry);
    assert.equal(plan.attempts[0].model, "best");

    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "missing", provider: "Alpha", score: 55 },
          { model: "only", provider: "Alpha", score: 54 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    plan = classPlan("best", registry);
    assert.equal(plan.attempts.length, 1);
    assert.equal(plan.attempts[0].model, "Alpha/only");
    assert.equal(plan.attempts[0].index, 0);
  });
});

test("equal scores sort by provider then model and no-score rows go last", async () => {
  await withShelfDataDir(async () => {
    const registry = new ModelRegistry({
      Providers: [
        { models: ["m1"], name: "Beta" },
        { models: ["m2"], name: "Alpha" }
      ],
      virtualModelProfiles: []
    });
    const snapshot = {
      excluded: [],
      review: [],
      shelves: {
        fable: [],
        haiku: [],
        opus: [
          { model: "m1", provider: "Beta", score: 55 },
          { model: "m2", provider: "Alpha", score: 55 },
          { model: "m2", provider: "Beta", score: undefined }
        ],
        sonnet: []
      },
      updatedAt: new Date().toISOString()
    };
    await writeShelfSnapshot(snapshot);
    const first = classPlan("best", registry).attempts.map((attempt) => attempt.model);
    await writeShelfSnapshot(snapshot);
    const second = classPlan("best", registry).attempts.map((attempt) => attempt.model);
    assert.deepEqual(first, ["Alpha/m2", "Beta/m1"]);
    assert.deepEqual(second, first);
    assert.equal(classPlan("best", registry).attempts.length, 2);
  });
});
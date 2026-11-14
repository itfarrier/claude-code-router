import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { recordClassRefusal } from "@ccr/core/class-switch/seam.ts";
import { writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

function benchRegistry() {
  return new ModelRegistry({
    Providers: [{ models: ["alpha/model-a", "beta/model-b"], name: "BenchProvider" }],
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

test("a benched higher score yields the next live model", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "beta/model-b", provider: "BenchProvider", score: 70 }
        ]
      },
      updatedAt: new Date().toISOString()
    });

    await recordClassRefusal(500, "BenchProvider", "alpha/model-a");

    const plan = classPlan("claude-opus-4-6", benchRegistry(), {
      toolNames: ["Read"],
      hasImage: false,
      estimatedTokens: 10,
      toolTurn: false,
      sessionId: "sess-1"
    });

    assert.equal(plan.attempts.length, 1);
    assert.equal(plan.attempts[0].model, "BenchProvider/beta/model-b");
  });
});
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { classifyModel, writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

function benchRegistry() {
  return new ModelRegistry({
    Providers: [{ models: ["motif-technologies/motif-3"], name: "BenchProvider" }],
    virtualModelProfiles: []
  });
}

test("claude-opus opens the scored opus shelf", async () => {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-class-switch-test-"));
  try {
    process.env.CCR_INTERNAL_USER_DATA_DIR = dir;
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
        fable: [],
        haiku: [],
        opus: [
          {
            model: "motif-technologies/motif-3",
            provider: "BenchProvider",
            score: classified.score
          }
        ],
        sonnet: []
      },
      updatedAt: new Date().toISOString()
    });

    const registry = benchRegistry();
    const plan = createRouteExecutionPlan({
      bodyModel: "claude-opus-4-6",
      fallback: { mode: "off", models: [], retryCount: 0 },
      hasRequestBody: true,
      modelRegistry: registry,
      primaryModel: "claude-opus-4-6"
    });

    assert.equal(plan.attempts.length, 1);
    assert.equal(plan.attempts[0].model, "BenchProvider/motif-technologies/motif-3");
    assert.equal(plan.attempts[0].target?.kind, "provider");
    assert.equal(plan.attempts[0].target?.model, "motif-technologies/motif-3");
    assert.equal(plan.primaryModel, "claude-opus-4-6");
    assert.deepEqual(plan.fallback, { mode: "off", models: [], retryCount: 0 });
  } finally {
    rmSync(dir, { force: true, recursive: true });
    if (previousDataDir === undefined) {
      delete process.env.CCR_INTERNAL_USER_DATA_DIR;
    } else {
      process.env.CCR_INTERNAL_USER_DATA_DIR = previousDataDir;
    }
  }
});
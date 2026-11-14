import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { isBenched, recordClassSuccess, resetClassSwitchBenchForTest } from "@ccr/core/class-switch/bench.ts";
import {
  attemptsForClass,
  liftToolResultImages,
  parseClassRequest,
  remember,
  requestFacts,
  setThinShareCounter
} from "@ccr/core/class-switch/plan.ts";
import { classShelfActive, recordClassRefusal } from "@ccr/core/class-switch/seam.ts";
import { writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

function benchRegistry(overrides = {}) {
  return new ModelRegistry({
    Providers: [
      {
        credentials: [{ api_key: "sk-one" }, { api_key: "sk-two", credentialId: "cred:second" }],
        models: ["alpha/model-a", "beta/model-b"],
        name: "BenchProvider",
        ...overrides.provider
      }
    ],
    virtualModelProfiles: []
  });
}

function visionRegistry() {
  return new ModelRegistry({
    Providers: [
      {
        modelMetadata: {
          "alpha/model-a": { capabilities: { imageInput: false } },
          "beta/model-b": {}
        },
        models: ["alpha/model-a", "beta/model-b"],
        name: "BenchProvider"
      }
    ],
    virtualModelProfiles: []
  });
}

function opusScalars(overrides = {}) {
  return {
    estimatedTokens: 10,
    hasImage: false,
    sessionId: undefined,
    toolNames: [],
    toolTurn: false,
    ...overrides
  };
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

test("a fully parked opus shelf keeps the parent attempt", async () => {
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
    await recordClassRefusal(500, "BenchProvider", "beta/model-b");

    const plan = classPlan("claude-opus-4-6", benchRegistry());
    assert.equal(plan.attempts.length, 1);
    assert.equal(plan.attempts[0].model, "claude-opus-4-6");
    assert.ok(!plan.attempts.some((attempt) => attempt.model?.includes("sonnet")));
  });
});

test("a class 400 refusal does not bench the model", async () => {
  await withShelfDataDir(async () => {
    await recordClassRefusal(400, "ProbeProvider", "probe-only");
    assert.equal(isBenched("ProbeProvider", "probe-only"), false);
  });
});

test("CCR_CLASS_SWITCH=0 keeps the parent attempt after a 5xx park", async () => {
  const previous = process.env.CCR_CLASS_SWITCH;
  try {
    process.env.CCR_CLASS_SWITCH = "0";
    await withShelfDataDir(async () => {
      await writeShelfSnapshot({
        excluded: [],
        review: [],
        shelves: {
          ...emptyShelves(),
          opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
        },
        updatedAt: new Date().toISOString()
      });
      await recordClassRefusal(500, "BenchProvider", "alpha/model-a");
      const plan = classPlan("claude-opus-4-6", benchRegistry());
      assert.equal(plan.attempts[0].model, "claude-opus-4-6");
    });
  } finally {
    if (previous === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previous;
    }
  }
});

test("an explicit false image capability drops only that model", async () => {
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

    const parsed = parseClassRequest("claude-opus-4-6");
  const attempts = attemptsForClass(parsed, visionRegistry(), { ...opusScalars(), hasImage: true });
    assert.equal(attempts?.length, 1);
    assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
  });
});

test("a higher unchecked score still beats a lower confirmed score", async () => {
  await withShelfDataDir(async () => {
    resetClassSwitchBenchForTest();
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 60 },
          { model: "beta/model-b", provider: "BenchProvider", score: 50 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    await recordClassSuccess("BenchProvider", "beta/model-b", "cred:main", { durationMs: 12, headers: {} });

    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.[0]?.model, "BenchProvider/alpha/model-a");
  });
});

test("equal scores put the confirmed model first", async () => {
  await withShelfDataDir(async () => {
    resetClassSwitchBenchForTest();
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 70 },
          { model: "beta/model-b", provider: "BenchProvider", score: 70 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    await recordClassSuccess("BenchProvider", "beta/model-b", "cred:main", { durationMs: 8, headers: {} });

    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
  });
});

test("estimatedTokens above a finite window drops that row", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { contextWindow: 100, model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { contextWindow: 10_000, model: "beta/model-b", provider: "BenchProvider", score: 70 }
        ]
      },
      updatedAt: new Date().toISOString()
    });

    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), {
      ...opusScalars(),
      estimatedTokens: 200
    });
    assert.equal(attempts?.length, 1);
    assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
  });
});

test("a missing window keeps the model on a large estimate", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
      },
      updatedAt: new Date().toISOString()
    });

    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), {
      ...opusScalars(),
      estimatedTokens: 5_000_000
    });
    assert.equal(attempts?.length, 1);
  });
});

test("a tool name plus toolCalling false drops the row", async () => {
  const previousCatalog = process.env.CCR_MODEL_CATALOG_PATH;
  const catalogPath = path.join(tmpdir(), `ccr-choice-catalog-${Date.now()}.json`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    catalogPath,
    JSON.stringify({
      models: [
        {
          capabilities: { toolCalling: false },
          id: "BenchProvider/alpha/model-a",
          model: "alpha/model-a",
          providers: ["BenchProvider"]
        },
        {
          capabilities: { toolCalling: true },
          id: "BenchProvider/beta/model-b",
          model: "beta/model-b",
          providers: ["BenchProvider"]
        }
      ]
    })
  );
  try {
    process.env.CCR_MODEL_CATALOG_PATH = catalogPath;
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

      const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), {
        ...opusScalars(),
        toolNames: ["Read"]
      });
      assert.equal(attempts?.length, 1);
      assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
    });
  } finally {
    if (previousCatalog === undefined) {
      delete process.env.CCR_MODEL_CATALOG_PATH;
    } else {
      process.env.CCR_MODEL_CATALOG_PATH = previousCatalog;
    }
    rmSync(catalogPath, { force: true });
  }
});

test("two attemptsForClass calls with no setThinShareCounter both keep the leader", async () => {
  await withShelfDataDir(async () => {
    setThinShareCounter(0);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "beta/model-b", provider: "BenchProvider", score: 79 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    const parsed = parseClassRequest("claude-opus-4-6");
    const registry = benchRegistry();
    const scalars = opusScalars();
    const first = attemptsForClass(parsed, registry, scalars);
    const second = attemptsForClass(parsed, registry, scalars);
    assert.equal(first?.[0]?.model, "BenchProvider/alpha/model-a");
    assert.equal(second?.[0]?.model, "BenchProvider/alpha/model-a");
  });
});

test("setThinShareCounter(19) then one call puts the neighbor first", async () => {
  await withShelfDataDir(async () => {
    setThinShareCounter(19);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "beta/model-b", provider: "BenchProvider", score: 79 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
  });
});

test("setThinShareCounter(20) then one call keeps the leader", async () => {
  await withShelfDataDir(async () => {
    setThinShareCounter(20);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "beta/model-b", provider: "BenchProvider", score: 79 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.[0]?.model, "BenchProvider/alpha/model-a");
  });
});

test("classShelfActive before a thin-share call does not consume the count", async () => {
  await withShelfDataDir(async () => {
    setThinShareCounter(19);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "beta/model-b", provider: "BenchProvider", score: 79 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    assert.equal(classShelfActive("claude-opus-4-6"), true);
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.[0]?.model, "BenchProvider/beta/model-b");
  });
});

test("two live credentials produce two rows with the same model selector", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
      },
      updatedAt: new Date().toISOString()
    });
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), opusScalars());
    assert.equal(attempts?.length, 2);
    assert.ok(attempts?.every((row) => row.model === "BenchProvider/alpha/model-a"));
  });
});

test("toolTurn true returns the remembered row", async () => {
  await withShelfDataDir(async () => {
    remember("sess-tool", { credentialId: "cred:second", model: "alpha/model-a", provider: "BenchProvider" });
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
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), {
      ...opusScalars(),
      sessionId: "sess-tool",
      toolTurn: true
    });
    assert.equal(attempts?.length, 1);
    assert.equal(attempts?.[0]?.model, "BenchProvider/alpha/model-a");
  });
});

test("a non-empty user text block does not use the remembered triple", async () => {
  await withShelfDataDir(async () => {
    remember("sess-text", { credentialId: "cred:second", model: "alpha/model-a", provider: "BenchProvider" });
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
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), benchRegistry(), {
      ...opusScalars(),
      sessionId: "sess-text",
      toolTurn: false
    });
    assert.ok((attempts?.length ?? 0) > 1);
  });
});

test("liftToolResultImages moves type image out of tool_result and leaves a text block", () => {
  const body = {
    messages: [
      {
        content: [
          {
            content: [{ text: "see", type: "text" }, { source: { type: "base64" }, type: "image" }],
            tool_use_id: "tu-1",
            type: "tool_result"
          }
        ],
        role: "user"
      }
    ]
  };
  const lifted = liftToolResultImages(structuredClone(body));
  const userContent = lifted.messages[0].content;
  assert.ok(userContent.some((block) => block.type === "image"));
  const toolResult = userContent.find((block) => block.type === "tool_result");
  assert.ok(toolResult);
  assert.ok(!toolResult.content.some((block) => block.type === "image"));
  assert.ok(toolResult.content.some((block) => block.type === "text"));
});

test("requestFacts marks toolTurn when the last user content is only tool_result blocks", () => {
  const body = Buffer.from(
    JSON.stringify({
      messages: [
        { content: "hello", role: "user" },
        { content: [{ tool_use_id: "x", type: "tool_result", content: [{ text: "ok", type: "text" }] }], role: "user" }
      ],
      metadata: { session_id: "meta-session" }
    })
  );
  const facts = requestFacts("POST", body);
  assert.equal(facts.toolTurn, true);
  assert.equal(facts.sessionId, "meta-session");
});
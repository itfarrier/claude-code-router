import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  benchRowUntil,
  isBenched,
  recordClassSuccess,
  resetClassSwitchBenchForTest
} from "@ccr/core/class-switch/bench.ts";
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
import { invalidateModelCatalogIndexForTest } from "@ccr/core/gateway/model-catalog.ts";
import { fetchUpstreamWithFallback } from "@ccr/core/gateway/upstream/executor.ts";
import { readProviderCredentialCooldown } from "@ccr/core/providers/credential-pool.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

const executorSourcePath = path.resolve("packages/core/src/gateway/upstream/executor.ts");

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

function benchRegistry() {
  return new ModelRegistry({
    Providers: [{ models: ["alpha/model-a", "beta/model-b"], name: "BenchProvider" }],
    virtualModelProfiles: []
  });
}

function twinCredentialRegistry() {
  return new ModelRegistry({
    Providers: [
      {
        credentials: [{ api_key: "sk-one" }, { api_key: "sk-two", id: "cred:second" }],
        models: ["alpha/model-a", "beta/model-b"],
        name: "BenchProvider"
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
          "beta/model-b": { capabilities: { imageInput: true } }
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

function writeTestModelCatalog(dir, models) {
  const file = path.join(dir, "choice-model-catalog.json");
  writeFileSync(file, JSON.stringify({ models, schemaVersion: 2 }));
  process.env.CCR_MODEL_CATALOG_PATH = file;
  invalidateModelCatalogIndexForTest();
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
  await withShelfDataDir(async (dir) => {
    resetGatewayBench();
    writeTestModelCatalog(dir, [
      {
        capabilities: { imageInput: true, toolCalling: true },
        id: "BenchProvider/beta/model-b",
        model: "beta/model-b",
        providers: ["BenchProvider"]
      }
    ]);
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
  setThinShareCounter(0);
  await withShelfDataDir(async () => {
    resetGatewayBench();
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
    resetGatewayBench();
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
    await withShelfDataDir(async (dir) => {
      writeTestModelCatalog(dir, [
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
      ]);
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
});

test("two attemptsForClass calls with no setThinShareCounter both keep the leader", async () => {
  setThinShareCounter(0);
  resetClassSwitchBenchForTest();
  await withShelfDataDir(async () => {
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
  setThinShareCounter(19);
  resetClassSwitchBenchForTest();
  await withShelfDataDir(async () => {
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
  setThinShareCounter(20);
  await withShelfDataDir(async () => {
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
  setThinShareCounter(19);
  resetClassSwitchBenchForTest();
  await withShelfDataDir(async () => {
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
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), twinCredentialRegistry(), opusScalars());
    assert.equal(attempts?.length, 2);
    assert.ok(attempts?.every((row) => row.model === "BenchProvider/alpha/model-a"));
  });
});

test("one parked credential keeps the model live for the other credential", async () => {
  await withShelfDataDir(async () => {
    resetGatewayBench();
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
      },
      updatedAt: new Date().toISOString()
    });
    await recordClassRefusal(429, "BenchProvider", "alpha/model-a", "key-1", new Headers({ "retry-after": "60" }));
    assert.equal(isBenched("BenchProvider", "alpha/model-a"), false);
    assert.equal(isBenched("BenchProvider", "alpha/model-a", "key-1"), true);
    assert.equal(isBenched("BenchProvider", "alpha/model-a", "cred:second"), false);
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), twinCredentialRegistry(), opusScalars());
    assert.equal(attempts?.length, 1);
    resetGatewayBench();
  });
});

test("a parked slug for a shifted credential keeps the row out of the plan", async () => {
  await withShelfDataDir(async () => {
    resetGatewayBench();
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
      },
      updatedAt: new Date().toISOString()
    });
    const shiftedRegistry = new ModelRegistry({
      Providers: [
        {
          credentials: [{ api_key: "sk-one", enabled: false }, { api_key: "sk-two" }],
          models: ["alpha/model-a"],
          name: "BenchProvider"
        }
      ],
      virtualModelProfiles: []
    });
    // The live credential sits at configured index 1, so the executor and the
    // bench both know it as key-2.
    await recordClassRefusal(429, "BenchProvider", "alpha/model-a", "key-2", new Headers({ "retry-after": "60" }));
    assert.equal(isBenched("BenchProvider", "alpha/model-a", "key-2"), true);
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), shiftedRegistry, opusScalars());
    assert.equal(attempts, undefined);
    resetGatewayBench();
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
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), twinCredentialRegistry(), {
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
    const attempts = attemptsForClass(parseClassRequest("claude-opus-4-6"), twinCredentialRegistry(), {
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

function gatewayChoiceConfig() {
  return {
    Providers: [
      {
        api_base_url: "https://bench.example/v1",
        capabilities: [{ type: "anthropic_messages" }],
        credentials: [
          { api_key: "sk-fixture-key-one" },
          { api_key: "sk-two", id: "cred:second" }
        ],
        models: ["alpha/model-a", "beta/model-b"],
        name: "BenchProvider",
        type: "anthropic_messages"
      }
    ],
    profile: { profiles: [] },
    Router: { fallback: { mode: "off", models: [], retryCount: 0 }, rules: [] },
    virtualModelProfiles: []
  };
}

function twinModelShelf() {
  return {
    excluded: [],
    review: [],
    shelves: {
      ...emptyShelves(),
      opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }]
    },
    updatedAt: new Date().toISOString()
  };
}

function resetGatewayBench() {
  resetClassSwitchBenchForTest();
  const dir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  if (dir) {
    try {
      rmSync(path.join(dir, "cache", "class-switch-bench.json"), { force: true });
    } catch {
      // ignore missing bench file
    }
  }
}

function fetchInitHeaders(init) {
  const raw = init?.headers;
  if (!raw) {
    return {};
  }
  if (typeof raw.forEach === "function") {
    const headers = {};
    raw.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }
  return { ...raw };
}

async function withClassGateway(shelf, run) {
  const previousSwitch = process.env.CCR_CLASS_SWITCH;
  process.env.CCR_CLASS_SWITCH = "1";
  try {
    await withShelfDataDir(async () => {
      resetGatewayBench();
      await writeShelfSnapshot(shelf);
      await run();
    });
  } finally {
    if (previousSwitch === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previousSwitch;
    }
  }
}

test("a class attempt sends one credential", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const config = gatewayChoiceConfig();
    const upstreamUrl = "http://127.0.0.1:3456/v1/messages";
  const fetchCalls = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const headers = fetchInitHeaders(init);
      const targetProviders = headers["x-target-providers"] ?? headers["X-Target-Providers"];
      fetchCalls.push({ headers, targetProviders });
      const index = fetchCalls.length;
      if (index === 1) {
        return new Response("{}", { headers: { "retry-after": "30" }, status: 429 });
      }
      return new Response("{}", { headers: { "content-type": "application/json" }, status: 200 });
    };

    try {
      const result = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.equal(fetchCalls.length, 2);
      assert.ok(!String(fetchCalls[0].targetProviders).includes(","));
      assert.equal(result.attempt.credentialIds?.length, 1);
      assert.equal(result.failedAttempts[0]?.credentialIds?.length, 1);
      assert.notEqual(fetchCalls[0].targetProviders, fetchCalls[1].targetProviders);
      assert.equal(result.failedAttempts[0]?.delayMs ?? 0, 0);
      assert.equal(result.response.status, 200);
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount += 1;
      return new Response("{}", { status: 400 });
    };
    try {
      await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.equal(fetchCount, 1);
      assert.equal(isBenched("BenchProvider", "alpha/model-a"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    fetchCalls.length = 0;
    const singleCredConfig = {
      ...config,
      Providers: [{ ...config.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
    };
    const provider = singleCredConfig.Providers[0];
    globalThis.fetch = async () => new Response("{}", { status: 503 });
    try {
      const serverError = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config: singleCredConfig,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.equal(serverError.response.status, 503);
      const firstCredential = provider.credentials[0];
      assert.equal(readProviderCredentialCooldown(provider, firstCredential), undefined);
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    fetchCalls.length = 0;
    globalThis.fetch = async (_url, init) => {
      fetchCalls.push(fetchInitHeaders(init));
      return fetchCalls.length === 1
        ? new Response("{}", { status: 402 })
        : new Response("{}", { status: 200 });
    };
    try {
      const paymentResult = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.equal(fetchCalls.length, 2);
      assert.notEqual(fetchCalls[0]["x-target-providers"], fetchCalls[1]["x-target-providers"]);
      assert.equal(paymentResult.failedAttempts[0]?.delayMs ?? 0, 0);
      assert.equal(isBenched("BenchProvider", "alpha/model-a"), false);
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    let networkFetches = 0;
    globalThis.fetch = async () => {
      networkFetches += 1;
      if (networkFetches === 1) {
        throw new Error("network reset");
      }
      return new Response("{}", { status: 200 });
    };
    try {
      const networkResult = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.equal(networkFetches, 2);
      // One class leg with the delay the loop actually used: no backoff entry.
      assert.equal(networkResult.failedAttempts.length, 1);
      assert.equal(networkResult.failedAttempts[0]?.delayMs, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    const metaCalls = [];
    globalThis.fetch = async (_url, init) => {
      metaCalls.push(fetchInitHeaders(init));
      return metaCalls.length === 1
        ? new Response("{}", { headers: { "content-type": "application/json" }, status: 402 })
        : new Response("{}", { headers: { "content-type": "application/json" }, status: 200 });
    };
    try {
      await fetchUpstreamWithFallback({
        body: Buffer.from(
          JSON.stringify({
            messages: [
              {
                content: [{ content: [{ text: "ok", type: "text" }], tool_use_id: "tu-1", type: "tool_result" }],
                role: "user"
              }
            ],
            metadata: { session_id: "sess-meta" },
            model: "claude-opus-4-6"
          })
        ),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      await fetchUpstreamWithFallback({
        body: Buffer.from(
          JSON.stringify({
            messages: [
              {
                content: [{ content: [{ text: "ok", type: "text" }], tool_use_id: "tu-1", type: "tool_result" }],
                role: "user"
              }
            ],
            metadata: { session_id: "sess-meta" },
            model: "claude-opus-4-6"
          })
        ),
        config,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl
      });
      assert.match(String(metaCalls.at(-1)["x-target-providers"]), /cred-second/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const previousSwitch = process.env.CCR_CLASS_SWITCH;
  try {
    process.env.CCR_CLASS_SWITCH = "0";
    await withShelfDataDir(async () => {
      resetGatewayBench();
      await writeShelfSnapshot(twinModelShelf());
      const headersSeen = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url, init) => {
        headersSeen.push(fetchInitHeaders(init));
        return new Response("{}", { status: 200 });
      };
      try {
        await fetchUpstreamWithFallback({
          body: Buffer.from(
            JSON.stringify({
              messages: [{ content: "hi", role: "user" }],
              model: "BenchProvider/alpha/model-a"
            })
          ),
          config: gatewayChoiceConfig(),
          coreAuthToken: "core-token",
          fallback: { mode: "off", models: [], retryCount: 0 },
          headers: {},
          method: "POST",
          path: "/v1/messages",
          routedModel: "BenchProvider/alpha/model-a",
          upstreamUrl: "http://127.0.0.1:3456/v1/messages"
        });
        assert.ok(String(headersSeen[0]["x-target-providers"] ?? "").includes(","));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  } finally {
    if (previousSwitch === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previousSwitch;
    }
  }

  setThinShareCounter(19);
  await withClassGateway(
    {
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
    },
    async () => {
      let firstModel;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body ?? "{}"));
        firstModel = body.model;
        return new Response("{}", { status: 200 });
      };
      try {
        await fetchUpstreamWithFallback({
          body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
          config: gatewayChoiceConfig(),
          coreAuthToken: "core-token",
          fallback: { mode: "off", models: [], retryCount: 0 },
          headers: {},
          method: "POST",
          path: "/v1/messages",
          routedModel: "claude-opus-4-6",
          upstreamUrl: "http://127.0.0.1:3456/v1/messages"
        });
        assert.ok(
          firstModel === "BenchProvider/beta/model-b" || firstModel === "beta/model-b",
          `unexpected first model ${firstModel}`
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );

  await withClassGateway(twinModelShelf(), async () => {
    let fetchCount = 0;
    const seen = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      fetchCount += 1;
      seen.push(fetchInitHeaders(init));
      return new Response("{}", { status: 404 });
    };
    try {
      await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config: gatewayChoiceConfig(),
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl: "http://127.0.0.1:3456/v1/messages"
      });
      assert.equal(fetchCount, 1);
      assert.ok(seen.every((headers) => !headers["x-target-provider"]));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("a failed class leg omits the provider key", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const originalInfo = console.info;
    const lines = [];
    console.info = (...args) => {
      lines.push(args.join(" "));
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("{}", { status: 403 });
    try {
      await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config: gatewayChoiceConfig(),
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl: "http://127.0.0.1:3456/v1/messages"
      });
      const leg = lines.find((line) => line.includes("[class-switch]"));
      assert.ok(leg);
      assert.match(leg, /credential=/);
      assert.doesNotMatch(leg, /sk-fixture-key-one/);
      assert.match(lines.join("\n"), /fix-key/);
      assert.doesNotMatch(readFileSync(executorSourcePath, "utf8"), /recordUsage/);
    } finally {
      console.info = originalInfo;
      globalThis.fetch = originalFetch;
    }
  });
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

test("requestFacts keeps tool facts when metadata is absent", () => {
  const noMetadata = Buffer.from(
    JSON.stringify({
      messages: [{ content: "hi", role: "user" }],
      tools: [{ function: { name: "Read" }, type: "function" }]
    })
  );
  const noMetadataFacts = requestFacts("POST", noMetadata);
  assert.deepEqual(noMetadataFacts.toolNames, ["Read"]);
  assert.equal(noMetadataFacts.sessionId, undefined);

  const nullMetadata = Buffer.from(
    JSON.stringify({
      messages: [{ content: "hi", role: "user" }],
      metadata: null,
      tools: [{ function: { name: "Bash" }, type: "function" }]
    })
  );
  const nullMetadataFacts = requestFacts("POST", nullMetadata);
  assert.deepEqual(nullMetadataFacts.toolNames, ["Bash"]);
  assert.equal(nullMetadataFacts.sessionId, undefined);
});

test("a stopped class refusal keeps a readable body", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const config = gatewayChoiceConfig();
    const singleCredConfig = {
      ...config,
      Providers: [{ ...config.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
    };
    const upstreamUrl = "http://127.0.0.1:3456/v1/messages";
    const classBody = () =>
      Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" }));
    const fetchInput = (providerConfig) => ({
      body: classBody(),
      config: providerConfig,
      coreAuthToken: "core-token",
      fallback: { mode: "off", models: [], retryCount: 0 },
      headers: {},
      method: "POST",
      path: "/v1/messages",
      routedModel: "claude-opus-4-6",
      upstreamUrl
    });
    const originalFetch = globalThis.fetch;
    const refusedFetch = (payload, status) => async () =>
      new Response(payload, {
        headers: {
          "content-length": String(Buffer.byteLength(payload)),
          "content-type": "application/json"
        },
        status
      });

    globalThis.fetch = refusedFetch(JSON.stringify({ error: { message: "shape" } }), 400);
    try {
      const shapeRefusal = await fetchUpstreamWithFallback(fetchInput(singleCredConfig));
      assert.equal(shapeRefusal.response.status, 400);
      assert.equal(JSON.parse(await shapeRefusal.response.text()).error.message, "shape");
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    globalThis.fetch = refusedFetch(JSON.stringify({ error: { message: "rate limited" } }), 429);
    try {
      const rateRefusal = await fetchUpstreamWithFallback(fetchInput(singleCredConfig));
      assert.equal(rateRefusal.response.status, 429);
      assert.equal(JSON.parse(await rateRefusal.response.text()).error.message, "rate limited");
    } finally {
      globalThis.fetch = originalFetch;
    }

    resetGatewayBench();
    setThinShareCounter(0);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [
          { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
          { model: "alpha/model-a", provider: "BenchProvider", score: 79 }
        ]
      },
      updatedAt: new Date().toISOString()
    });
    globalThis.fetch = refusedFetch(JSON.stringify({ error: { message: "rate limited" } }), 429);
    try {
      const skippedLeg = await fetchUpstreamWithFallback(fetchInput(config));
      assert.equal(skippedLeg.response.status, 429);
      assert.equal(JSON.parse(await skippedLeg.response.text()).error.message, "rate limited");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("a bench-file write failure keeps the refusal body readable", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const config = gatewayChoiceConfig();
    const singleCredConfig = {
      ...config,
      Providers: [{ ...config.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
    };
    // Poison the bench snapshot path: the file name is a directory, so the
    // snapshot's rename fails. The bench is a side channel — the disk error
    // must not turn the refusal into a network error or lose the body.
    const benchPath = path.join(process.env.CCR_INTERNAL_USER_DATA_DIR, "cache", "class-switch-bench.json");
    mkdirSync(benchPath, { recursive: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        headers: { "content-type": "application/json" },
        status: 429
      });
    try {
      const result = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config: singleCredConfig,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl: "http://127.0.0.1:3456/v1/messages"
      });
      assert.equal(result.response.status, 429);
      assert.equal(JSON.parse(await result.response.text()).error.message, "rate limited");
      assert.deepEqual(result.failedAttempts, []);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(benchPath, { recursive: true, force: true });
    }
    resetGatewayBench();
  });
});

test("a bench-file write failure keeps a succeeded 2xx response", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const config = gatewayChoiceConfig();
    const singleCredConfig = {
      ...config,
      Providers: [{ ...config.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
    };
    const benchPath = path.join(process.env.CCR_INTERNAL_USER_DATA_DIR, "cache", "class-switch-bench.json");
    mkdirSync(benchPath, { recursive: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("{}", { headers: { "content-type": "application/json" }, status: 200 });
    try {
      const result = await fetchUpstreamWithFallback({
        body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
        config: singleCredConfig,
        coreAuthToken: "core-token",
        fallback: { mode: "off", models: [], retryCount: 0 },
        headers: {},
        method: "POST",
        path: "/v1/messages",
        routedModel: "claude-opus-4-6",
        upstreamUrl: "http://127.0.0.1:3456/v1/messages"
      });
      // The disk error inside the bench record must not discard the already
      // succeeded response or retry the request.
      assert.equal(result.response.status, 200);
      assert.deepEqual(result.failedAttempts, []);
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(benchPath, { recursive: true, force: true });
    }
    resetGatewayBench();
  });
});

test("the lifted tool_result image reaches the next shelf model", async () => {
  await withClassGateway(
    {
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
    },
    async () => {
      const base = gatewayChoiceConfig();
      const singleCredConfig = {
        ...base,
        Providers: [{ ...base.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
      };
      const bodies = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body ?? "{}")));
        if (bodies.length === 1) {
          return new Response("{}", { headers: { "retry-after": "30" }, status: 429 });
        }
        return new Response("{}", { status: 200 });
      };
      try {
        const result = await fetchUpstreamWithFallback({
          body: Buffer.from(
            JSON.stringify({
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
              ],
              model: "claude-opus-4-6"
            })
          ),
          config: singleCredConfig,
          coreAuthToken: "core-token",
          fallback: { mode: "off", models: [], retryCount: 0 },
          headers: {},
          method: "POST",
          path: "/v1/messages",
          routedModel: "claude-opus-4-6",
          upstreamUrl: "http://127.0.0.1:3456/v1/messages"
        });
        assert.equal(result.response.status, 200);
        assert.equal(bodies.length, 2);
        const secondContent = bodies[1].messages[0].content;
        assert.ok(secondContent.some((block) => block.type === "image"), "image was not lifted for the second leg");
        const toolResult = secondContent.find((block) => block.type === "tool_result");
        assert.ok(toolResult);
        assert.ok(toolResult.content.every((block) => block.type !== "image"));
      } finally {
        globalThis.fetch = originalFetch;
      }
      resetGatewayBench();
    }
  );
});

test("a 429 on one shelf model does not skip the next model for that credential", async () => {
  await withClassGateway(
    {
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
    },
    async () => {
      const base = gatewayChoiceConfig();
      const singleCredConfig = {
        ...base,
        Providers: [{ ...base.Providers[0], credentials: [{ api_key: "sk-fixture-key-one" }] }]
      };
      const models = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (_url, init) => {
        models.push(String(JSON.parse(String(init?.body ?? "{}")).model));
        if (models.length === 1) {
          return new Response("{}", { headers: { "retry-after": "30" }, status: 429 });
        }
        return new Response("{}", { status: 200 });
      };
      try {
        const result = await fetchUpstreamWithFallback({
          body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
          config: singleCredConfig,
          coreAuthToken: "core-token",
          fallback: { mode: "off", models: [], retryCount: 0 },
          headers: {},
          method: "POST",
          path: "/v1/messages",
          routedModel: "claude-opus-4-6",
          upstreamUrl: "http://127.0.0.1:3456/v1/messages"
        });
        assert.equal(models.length, 2);
        assert.ok(models[1].includes("beta/model-b"), `unexpected second model ${models[1]}`);
        assert.equal(result.response.status, 200);
      } finally {
        globalThis.fetch = originalFetch;
      }
      resetGatewayBench();
    }
  );
});

test("a class 2xx updates the bench without a session id", async () => {
  await withClassGateway(twinModelShelf(), async () => {
    const config = gatewayChoiceConfig();
    const upstreamUrl = "http://127.0.0.1:3456/v1/messages";
    const classInput = {
      body: Buffer.from(JSON.stringify({ messages: [{ content: "hi", role: "user" }], model: "claude-opus-4-6" })),
      config,
      coreAuthToken: "core-token",
      fallback: { mode: "off", models: [], retryCount: 0 },
      headers: {},
      method: "POST",
      path: "/v1/messages",
      routedModel: "claude-opus-4-6",
      upstreamUrl
    };
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      calls.push(fetchInitHeaders(init));
      return new Response("{}", {
        headers: {
          "content-type": "application/json",
          "x-ratelimit-remaining-requests": "0",
          "x-ratelimit-reset-requests": "7.66s"
        },
        status: 200
      });
    };
    try {
      await fetchUpstreamWithFallback(classInput);
      // No session id anywhere: the zero-remaining 2xx still parks key-1.
      assert.notEqual(benchRowUntil("BenchProvider", "key-1", "alpha/model-a"), undefined);
      await fetchUpstreamWithFallback(classInput);
      // The next request therefore starts on the second credential.
      assert.match(String(calls[1]["x-target-providers"]), /cred-second/);
    } finally {
      globalThis.fetch = originalFetch;
    }
    resetGatewayBench();
  });
});
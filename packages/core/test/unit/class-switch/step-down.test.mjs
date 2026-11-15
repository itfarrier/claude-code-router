import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { recordClassRefusal, resetClassSwitchBenchForTest } from "@ccr/core/class-switch/bench.ts";
import { writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import { clearSwapNotice, recordStepDownSuccess, recordSwapNotice, readSwapNotice } from "@ccr/core/class-switch/notice.ts";
import { setThinShareCounter } from "@ccr/core/class-switch/plan.ts";
import { getSwapNotice } from "@ccr/core/class-switch/seam.ts";
import { ClaudeCodeRouterPlugin } from "@ccr/core/gateway/claude-code-router-plugin.ts";
import { GatewayRequestPipeline } from "@ccr/core/gateway/request/pipeline.ts";
import { flushRequestLogRuntime, requestLogRuntime } from "@ccr/core/observability/request-log-store.ts";
import { fetchUpstreamWithFallback } from "@ccr/core/gateway/upstream/executor.ts";
import { createRouteExecutionPlan } from "@ccr/core/routing/execution-plan.ts";
import { ModelRegistry } from "@ccr/core/routing/model-registry.ts";

const REQUESTED_MODEL = "claude-opus-4-6";
const SERVED_MODEL = "SonnetProvider/sonnet-live";
const FIXTURE_SECRET = "sk-sonnet-secret";
const REQUEST_MARKER = "private-user-message";

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

function shelf(overrides = {}) {
  return {
    excluded: [],
    review: [],
    shelves: { ...emptyShelves(), ...overrides },
    updatedAt: new Date().toISOString()
  };
}

// One provider spec feeds both the model registry and the gateway config so
// the planner resolves targets and the executor resolves credentials.
function providerSpec(name, models, options = {}) {
  return {
    api_base_url: "https://upstream.example/v1",
    capabilities: [{ type: "anthropic_messages" }],
    credentials: options.credentials ?? [{ api_key: FIXTURE_SECRET, id: "cred:sonnet" }],
    models,
    name,
    type: "anthropic_messages",
    ...(options.extra ?? {})
  };
}

function registryFrom(specs) {
  return new ModelRegistry({ Providers: specs, virtualModelProfiles: [] });
}

function sonnetSpec() {
  return providerSpec("SonnetProvider", ["sonnet-live"]);
}

function sonnetRegistry() {
  return registryFrom([sonnetSpec()]);
}

function twinSonnetSpec() {
  return providerSpec("SonnetProvider", ["sonnet-live"], {
    credentials: [{ api_key: FIXTURE_SECRET }, { api_key: "sk-sonnet-two", id: "cred:second" }]
  });
}

function classFamilyRegistry() {
  return registryFrom([
    providerSpec("FableP", ["fable-model"], { credentials: [{ api_key: "sk-fable" }] }),
    providerSpec("OpusP", ["opus-model"], { credentials: [{ api_key: "sk-opus" }] }),
    providerSpec("SonnetP", ["sonnet-model"], { credentials: [{ api_key: "sk-sonnetp" }] }),
    providerSpec("HaikuP", ["haiku-model"], { credentials: [{ api_key: "sk-haiku" }] })
  ]);
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
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-step-down-test-"));
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

// Restores every environment, bench, and notice mutation around one case.
async function withStepDownGateway(shelfSnapshot, run) {
  const previousSwitch = process.env.CCR_CLASS_SWITCH;
  setThinShareCounter(0);
  try {
    process.env.CCR_CLASS_SWITCH = "1";
    await withShelfDataDir(async () => {
      resetGatewayBench();
      clearSwapNotice();
      await writeShelfSnapshot(shelfSnapshot);
      await run();
    });
  } finally {
    clearSwapNotice();
    resetGatewayBench();
    if (previousSwitch === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previousSwitch;
    }
  }
}

function sseBody(model) {
  return [
    "event: message_start\n",
    `data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"${model}","content":[]}}\n`,
    "\n",
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"keep this"}}\n\n',
    "data: [DONE]\n\n"
  ].join("");
}

class CapturingResponse extends Writable {
  constructor() {
    super();
    this.chunks = [];
    this.headers = {};
    this.statusCode = 0;
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = Object.fromEntries(
      Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), String(value)])
    );
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  bodyText() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function pipelineConfig(providers, requestLogsEnabled) {
  return {
    CUSTOM_ROUTER_PATH: "",
    Providers: providers,
    Router: {
      builtInRules: { "claude-code": { enabled: false }, codex: { enabled: false } },
      fallback: { mode: "off", models: [], retryCount: 0 },
      rules: []
    },
    contextArchive: { enabled: false, mcpEnabled: false },
    observability: { requestLogs: requestLogsEnabled },
    preferredProvider: "",
    profile: { enabled: false, profiles: [] },
    toolHub: { enabled: false },
    virtualModelProfiles: []
  };
}

// GatewayRequestPipeline harness adapted from
// packages/core/test/unit/gateway/anthropic-response-model.test.mjs.
async function runStepDownPipeline(requestModel, options = {}) {
  const config = pipelineConfig(options.providers ?? [sonnetSpec()], options.requestLogs === true);
  const plugin = new ClaudeCodeRouterPlugin(config);
  const pipeline = new GatewayRequestPipeline({
    getBrowserWebSearchMcpIntegration: () => undefined,
    getConfig: () => config,
    getCoreAuthToken: () => "core-token",
    getPlugin: () => plugin,
    getStatus: () => ({
      coreEndpoint: "http://127.0.0.1:65535",
      endpoint: "http://127.0.0.1:3456"
    })
  });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const fetchCalls = [];
  let upstreamBody;
  let upstreamHeaders;
  let failure;
  console.warn = (message, ...args) => {
    if (String(message).startsWith("[usage] Failed to record usage:")) {
      return;
    }
    originalWarn(message, ...args);
  };
  globalThis.fetch = async (_input, init) => {
    upstreamBody = JSON.parse(String(init?.body));
    upstreamHeaders = Object.fromEntries(new Headers(init?.headers).entries());
    fetchCalls.push({ body: upstreamBody, headers: upstreamHeaders });
    return new Response(sseBody(options.upstreamModel ?? "sonnet-live"), {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        ...(options.upstreamResponseHeaders ?? {})
      },
      status: options.upstreamStatus ?? 200
    });
  };

  try {
    const request = Readable.from([JSON.stringify({
      max_tokens: 64,
      messages: [{ content: REQUEST_MARKER, role: "user" }],
      model: requestModel,
      stream: true
    })]);
    request.headers = {
      "content-type": "application/json",
      "user-agent": "claude-code/1.0",
      ...(options.requestHeaders ?? {})
    };
    request.method = "POST";
    request.url = "/v1/messages";

    const response = new CapturingResponse();
    const finished = new Promise((resolve, reject) => {
      response.once("finish", resolve);
      response.once("error", reject);
    });
    try {
      await pipeline.proxyRequest(request, response, "/v1/messages");
    } catch (error) {
      failure = error;
    }
    if (!failure) {
      await finished;
    }

    return {
      failure,
      fetchCalls,
      output: response.bodyText(),
      response,
      upstreamBody,
      upstreamHeaders
    };
  } finally {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

// fetchUpstreamWithFallback harness with a scripted response queue.
async function runClassExecutor(config, options = {}) {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  const queue = [...(options.responses ?? [])];
  globalThis.fetch = async (_url, init) => {
    fetchCalls.push({
      body: JSON.parse(String(init?.body ?? "{}")),
      targetProviders: new Headers(init?.headers).get("x-target-providers")
    });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return next;
  };
  try {
    const result = await fetchUpstreamWithFallback({
      body: Buffer.from(JSON.stringify({
        messages: [{ content: "hi", role: "user" }],
        model: options.routedModel ?? REQUESTED_MODEL
      })),
      config,
      coreAuthToken: "core-token",
      fallback: { mode: "off", models: [], retryCount: 0 },
      headers: {},
      method: "POST",
      path: "/v1/messages",
      routedModel: options.routedModel ?? REQUESTED_MODEL,
      upstreamUrl: "http://127.0.0.1:65535/v1/messages"
    });
    return { error: undefined, fetchCalls, result };
  } catch (error) {
    return { error, fetchCalls, result: undefined };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function executorConfig(specs) {
  return {
    Providers: specs,
    Router: { fallback: { mode: "off", models: [], retryCount: 0 }, rules: [] },
    profile: { enabled: false, profiles: [] },
    virtualModelProfiles: []
  };
}

function swapNoticeRecord(overrides = {}) {
  return {
    credentialLabel: "cred-sonnet",
    model: "sonnet-live",
    provider: "SonnetProvider",
    reason: "no live Opus triple",
    requestedClass: "opus",
    safeguardsApplies: false,
    servedClass: "sonnet",
    sinceAt: new Date().toISOString(),
    ...overrides
  };
}

async function until(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) {
      return;
    }
    if (Date.now() > deadline) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// ---------------------------------------------------------------------------
// Pipeline tracer: the named end-to-end step-down case.
// ---------------------------------------------------------------------------

test("an empty Opus shelf returns a Sonnet Claude success with one notice", async () => {
  await withStepDownGateway(shelf({ sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] }), async () => {
    const result = await runStepDownPipeline(REQUESTED_MODEL, { requestLogs: true });

    // The upstream receives the served route, not the requested class name.
    assert.equal(result.failure, undefined);
    assert.equal(result.upstreamBody?.model, "sonnet-live");
    assert.equal(result.response.statusCode, 200);
    assert.match(result.output, /"model":"claude-opus-4-6"/);
    assert.doesNotMatch(result.output, /sonnet-live/);

    // The paired headers name the requested model and the final provider route.
    assert.equal(result.response.headers["x-ccr-requested-model"], REQUESTED_MODEL);
    assert.equal(result.response.headers["x-ccr-served-model"], SERVED_MODEL);

    // One current notice describes the actual swap.
    const notice = await getSwapNotice({ modelRegistry: sonnetRegistry() });
    assert.ok(notice);
    assert.equal(notice.requestedClass, "opus");
    assert.equal(notice.servedClass, "sonnet");
    assert.equal(notice.model, "sonnet-live");
    assert.equal(notice.provider, "SonnetProvider");
    assert.equal(notice.credentialLabel, "cred-sonnet");
    assert.equal(notice.reason, "no live Opus triple");
    assert.equal(notice.safeguardsApplies, false);
    assert.ok(notice.sinceAt);
    assert.equal(Number.isNaN(Date.parse(notice.sinceAt)), false);

    // No fixture secret and no request text in the notice or the paired headers.
    const noticeJson = JSON.stringify(notice);
    assert.doesNotMatch(noticeJson, new RegExp(FIXTURE_SECRET.replaceAll("-", "\\-")));
    assert.doesNotMatch(noticeJson, new RegExp(REQUEST_MARKER));
    const headerJson = JSON.stringify({
      requested: result.response.headers["x-ccr-requested-model"],
      served: result.response.headers["x-ccr-served-model"]
    });
    assert.doesNotMatch(headerJson, new RegExp(FIXTURE_SECRET.replaceAll("-", "\\-")));
    assert.doesNotMatch(headerJson, new RegExp(REQUEST_MARKER));

    // The notice-specific request-log fields carry the swap without secrets.
    await until(async () => {
      await flushRequestLogRuntime(1000).catch(() => undefined);
      const page = await requestLogRuntime.list({ pageSize: 20 }).catch(() => ({ items: [] }));
      return page.items.some((entry) => entry.requestedModel === REQUESTED_MODEL && entry.statusCode === 200);
    });
    const page = await requestLogRuntime.list({ pageSize: 20 }).catch(() => ({ items: [] }));
    const entry = page.items.find((item) => item.requestedModel === REQUESTED_MODEL && item.statusCode === 200);
    assert.ok(entry);
    const noticeLogFields = JSON.stringify({
      credentialChain: entry.credentialChain,
      credentialId: entry.credentialId,
      provider: entry.provider,
      responseHeaders: entry.responseHeaders,
      routeTrace: entry.routeTrace
    });
    assert.doesNotMatch(noticeLogFields, new RegExp(FIXTURE_SECRET.replaceAll("-", "\\-")));
    assert.doesNotMatch(noticeLogFields, new RegExp(REQUEST_MARKER));
    // The served route reached the log's resolved model unchanged.
    assert.equal(entry.resolvedModel, SERVED_MODEL);
    assert.equal(entry.responseHeaders["x-ccr-requested-model"], REQUESTED_MODEL);
    assert.equal(entry.responseHeaders["x-ccr-served-model"], SERVED_MODEL);
  });
});

test("a same-class success sets no step-down headers even when the upstream supplies them", async () => {
  await withStepDownGateway(
    shelf({ opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }] }),
    async () => {
      const specs = [providerSpec("BenchProvider", ["alpha/model-a"], { credentials: [{ api_key: "sk-bench", id: "cred:bench" }] })];
      const result = await runStepDownPipeline(REQUESTED_MODEL, {
        providers: specs,
        upstreamModel: "alpha/model-a",
        upstreamResponseHeaders: {
          "x-ccr-requested-model": "forged-requested",
          "x-ccr-served-model": "forged-served"
        }
      });

      assert.equal(result.failure, undefined);
      assert.equal(result.upstreamBody?.model, "alpha/model-a");
      assert.equal(result.response.statusCode, 200);
      assert.equal(result.response.headers["x-ccr-requested-model"], undefined);
      assert.equal(result.response.headers["x-ccr-served-model"], undefined);
      assert.equal(await getSwapNotice({ modelRegistry: registryFrom(specs) }), null);
    }
  );
});

test("a non-class response drops upstream supplied step-down headers", async () => {
  await withStepDownGateway(
    shelf({ sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] }),
    async () => {
      const result = await runStepDownPipeline(SERVED_MODEL, {
        upstreamModel: "sonnet-live",
        upstreamResponseHeaders: {
          "x-ccr-requested-model": "forged-requested",
          "x-ccr-served-model": "forged-served"
        }
      });

      assert.equal(result.failure, undefined);
      assert.equal(result.response.statusCode, 200);
      assert.equal(result.response.headers["x-ccr-requested-model"], undefined);
      assert.equal(result.response.headers["x-ccr-served-model"], undefined);
      assert.equal(await getSwapNotice({ modelRegistry: sonnetRegistry() }), null);
    }
  );
});

test("an all-empty shelf set errors the request without a provider success", async () => {
  await withStepDownGateway(shelf(), async () => {
    const result = await runStepDownPipeline(REQUESTED_MODEL);
    assert.ok(result.failure);
    assert.equal(result.fetchCalls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Executor walk: refusals fall through to the lower class in one list.
// ---------------------------------------------------------------------------

test("a requested refusal falls through to the lower-class success", async () => {
  await withStepDownGateway(
    shelf({
      opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }],
      sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }]
    }),
    async () => {
      const specs = [
        providerSpec("BenchProvider", ["alpha/model-a"], { credentials: [{ api_key: "sk-bench", id: "cred:bench" }] }),
        sonnetSpec()
      ];
      const { error, fetchCalls, result } = await runClassExecutor(executorConfig(specs), {
        responses: [
          new Response("{}", { headers: { "content-type": "application/json" }, status: 429 }),
          new Response("{}", { headers: { "content-type": "application/json" }, status: 200 })
        ]
      });
      assert.equal(error, undefined);
      assert.equal(fetchCalls.length, 2);
      assert.equal(fetchCalls[0].body.model, "alpha/model-a");
      assert.equal(fetchCalls[1].body.model, "sonnet-live");
      assert.equal(result.response.status, 200);
      assert.equal(result.failedAttempts.length, 1);
    }
  );
});

test("every row refusing keeps the last refusal without a lower-class success", async () => {
  await withStepDownGateway(
    shelf({
      opus: [{ model: "alpha/model-a", provider: "BenchProvider", score: 80 }],
      sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }]
    }),
    async () => {
      const specs = [
        providerSpec("BenchProvider", ["alpha/model-a"], { credentials: [{ api_key: "sk-bench", id: "cred:bench" }] }),
        sonnetSpec()
      ];
      const refusal = () => new Response("{}", { headers: { "content-type": "application/json" }, status: 429 });
      const { error, fetchCalls, result } = await runClassExecutor(executorConfig(specs), {
        responses: [refusal(), refusal()]
      });
      assert.equal(error, undefined);
      assert.equal(fetchCalls.length, 2);
      assert.equal(result.response.status, 429);
      assert.equal(result.failedAttempts.length, 2);
    }
  );
});

test("an all-empty shelf set returns an empty attempt list and the terminal error", async () => {
  await withStepDownGateway(shelf(), async () => {
    const plan = classPlan(REQUESTED_MODEL, sonnetRegistry());
    assert.deepEqual(plan.attempts, []);

    const { error, fetchCalls } = await runClassExecutor(executorConfig([sonnetSpec()]), {
      responses: [new Response("{}", { status: 200 })]
    });
    assert.ok(error);
    assert.match(String(error.message), /before reaching an upstream provider/);
    assert.equal(fetchCalls.length, 0);
  });
});

test("independent requests rebuild the list with a fresh request-local sent set", async () => {
  await withStepDownGateway(
    shelf({ sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] }),
    async () => {
      const { error: firstError, fetchCalls: firstCalls, result: firstResult } = await runClassExecutor(
        executorConfig([twinSonnetSpec()]),
        {
          responses: [
            new Response("{}", { headers: { "content-type": "application/json" }, status: 429 }),
            new Response("{}", { headers: { "content-type": "application/json" }, status: 200 })
          ]
        }
      );
      assert.equal(firstError, undefined);
      assert.equal(firstCalls.length, 2);
      assert.match(String(firstCalls[0].targetProviders), /cred:key-1/);
      assert.match(String(firstCalls[1].targetProviders), /cred:cred-second/);
      assert.equal(firstResult.response.status, 200);

      // A later request starts the shelf from the first credential again.
      const { error: secondError, fetchCalls: secondCalls } = await runClassExecutor(
        executorConfig([twinSonnetSpec()]),
        { responses: [new Response("{}", { status: 200 })] }
      );
      assert.equal(secondError, undefined);
      assert.equal(secondCalls.length, 1);
      assert.match(String(secondCalls[0].targetProviders), /cred:key-1/);
      assert.doesNotMatch(String(secondCalls[0].targetProviders), /cred:cred-second/);
    }
  );
});

// ---------------------------------------------------------------------------
// Planner: ordered cross-class attempt lists.
// ---------------------------------------------------------------------------

test("requested-class priority beats every model below", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot(shelf({
      fable: [{ model: "fable-model", provider: "FableP", score: 70 }],
      haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }],
      opus: [{ model: "opus-model", provider: "OpusP", score: 55 }],
      sonnet: [{ model: "sonnet-model", provider: "SonnetP", score: 35 }]
    }));
    const attempts = classPlan(REQUESTED_MODEL, classFamilyRegistry()).attempts;
    assert.deepEqual(
      attempts.map((attempt) => attempt.model),
      ["OpusP/opus-model", "SonnetP/sonnet-model", "HaikuP/haiku-model"]
    );
  });
});

test("each lower class serves in Fable then Opus then Sonnet then Haiku order", async () => {
  await withShelfDataDir(async () => {
    const registry = classFamilyRegistry();

    await writeShelfSnapshot(shelf({ opus: [{ model: "opus-model", provider: "OpusP", score: 55 }] }));
    assert.deepEqual(
      classPlan("claude-fable-5", registry).attempts.map((attempt) => attempt.model),
      ["OpusP/opus-model"]
    );

    await writeShelfSnapshot(shelf({ sonnet: [{ model: "sonnet-model", provider: "SonnetP", score: 35 }] }));
    assert.deepEqual(
      classPlan(REQUESTED_MODEL, registry).attempts.map((attempt) => attempt.model),
      ["SonnetP/sonnet-model"]
    );

    await writeShelfSnapshot(shelf({ haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }] }));
    assert.deepEqual(
      classPlan("claude-sonnet-4-6", registry).attempts.map((attempt) => attempt.model),
      ["HaikuP/haiku-model"]
    );

    await writeShelfSnapshot(shelf({ haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }] }));
    assert.deepEqual(
      classPlan(REQUESTED_MODEL, registry).attempts.map((attempt) => attempt.model),
      ["HaikuP/haiku-model"]
    );

    await writeShelfSnapshot(shelf({
      haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }],
      opus: [{ model: "opus-model", provider: "OpusP", score: 55 }],
      sonnet: [{ model: "sonnet-model", provider: "SonnetP", score: 35 }]
    }));
    assert.deepEqual(
      classPlan("claude-fable-5", registry).attempts.map((attempt) => attempt.model),
      ["OpusP/opus-model", "SonnetP/sonnet-model", "HaikuP/haiku-model"]
    );
  });
});

test("a shelf with exactly one live row yields that one attempt", async () => {
  await withStepDownGateway(
    shelf({
      haiku: [{ model: "haiku-model", provider: "HaikuP", score: 10 }],
      sonnet: [{ model: "sonnet-model", provider: "SonnetP", score: 35 }]
    }),
    async () => {
      await recordClassRefusal(500, "SonnetP", "sonnet-model");
      const attempts = classPlan("claude-sonnet-4-6", classFamilyRegistry()).attempts;
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].model, "HaikuP/haiku-model");
    }
  );
});

test("exact one-million filtering holds across the step-down list", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot(shelf({
      opus: [{ contextWindow: 999_999, model: "narrow", provider: "OpusP", score: 55 }],
      sonnet: [
        { contextWindow: 1_000_000, model: "wide", provider: "SonnetP", score: 35 },
        { contextWindow: 999_999, model: "narrow", provider: "SonnetP", score: 34 }
      ]
    }));
    const attempts = classPlan("opus[1m]", registryFrom([
      providerSpec("OpusP", ["wide", "narrow"], { credentials: [{ api_key: "sk-opus" }] }),
      providerSpec("SonnetP", ["wide", "narrow"], { credentials: [{ api_key: "sk-sonnetp" }] })
    ])).attempts;
    assert.deepEqual(
      attempts.map((attempt) => attempt.model),
      ["SonnetP/wide"]
    );
  });
});

test("non-class and kill-switch requests keep the parent attempt", async () => {
  await withStepDownGateway(
    shelf({ sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] }),
    async () => {
      const nonClass = classPlan("best-model", sonnetRegistry());
      assert.equal(nonClass.attempts.length, 1);
      assert.equal(nonClass.attempts[0].model, "best-model");
      assert.equal(nonClass.attempts[0].target, undefined);

      const previous = process.env.CCR_CLASS_SWITCH;
      try {
        process.env.CCR_CLASS_SWITCH = "0";
        const plan = classPlan(REQUESTED_MODEL, sonnetRegistry());
        assert.equal(plan.attempts.length, 1);
        assert.equal(plan.attempts[0].model, REQUESTED_MODEL);
        assert.equal(plan.attempts[0].target, undefined);
      } finally {
        if (previous === undefined) {
          delete process.env.CCR_CLASS_SWITCH;
        } else {
          process.env.CCR_CLASS_SWITCH = previous;
        }
      }
    }
  );
});

test("one thin-share decision spans the whole step-down plan", async () => {
  await withShelfDataDir(async () => {
    await writeShelfSnapshot(shelf({
      sonnet: [
        { model: "alpha/model-a", provider: "BenchProvider", score: 80 },
        { model: "beta/model-b", provider: "BenchProvider", score: 79 }
      ]
    }));
    const registry = registryFrom([
      providerSpec("BenchProvider", ["alpha/model-a", "beta/model-b"], { credentials: [{ api_key: "sk-bench" }] })
    ]);

    setThinShareCounter(19);
    const first = classPlan(REQUESTED_MODEL, registry).attempts.map((attempt) => attempt.model);
    assert.deepEqual(first, ["BenchProvider/beta/model-b", "BenchProvider/alpha/model-a"]);

    // The second plan consumed the next decision slot: no second reorder.
    const second = classPlan(REQUESTED_MODEL, registry).attempts.map((attempt) => attempt.model);
    assert.deepEqual(second, ["BenchProvider/alpha/model-a", "BenchProvider/beta/model-b"]);
  });
});

// ---------------------------------------------------------------------------
// Notice module: one record, replacement, and live-again reconciliation.
// ---------------------------------------------------------------------------

test("a swap notice read returns null without a swap", async () => {
  await withStepDownGateway(shelf(), async () => {
    assert.equal(await readSwapNotice({ modelRegistry: sonnetRegistry() }), null);
    assert.equal(await getSwapNotice({ modelRegistry: sonnetRegistry() }), null);
  });
});

test("the latest recorded swap is the single read result", async () => {
  await withStepDownGateway(shelf(), async () => {
    const replaced = recordSwapNotice(swapNoticeRecord({ servedClass: "sonnet" }));
    assert.ok(replaced);
    const latest = recordSwapNotice(swapNoticeRecord({ model: "haiku-live", servedClass: "haiku" }));
    assert.ok(latest);

    const notice = await readSwapNotice({ modelRegistry: sonnetRegistry() });
    assert.ok(notice);
    assert.equal(notice.servedClass, "haiku");
    assert.equal(notice.model, "haiku-live");
  });
});

test("a recovered requested class clears the notice on read", async () => {
  await withStepDownGateway(shelf(), async () => {
    recordSwapNotice(swapNoticeRecord({ requestedClass: "opus" }));
    await writeShelfSnapshot(shelf({ opus: [{ model: "opus-model", provider: "OpusP", score: 55 }] }));
    const registry = registryFrom([
      providerSpec("OpusP", ["opus-model"], { credentials: [{ api_key: "sk-opus" }] })
    ]);

    assert.equal(await readSwapNotice({ modelRegistry: registry }), null);
    // The record is gone: a second read is null even with the same state.
    assert.equal(await readSwapNotice({ modelRegistry: registry }), null);
  });
});

test("class-level recovery ignores request-specific capability differences", async () => {
  await withStepDownGateway(shelf(), async () => {
    recordSwapNotice(swapNoticeRecord({ requestedClass: "opus" }));
    // The only live row has a narrow window, so the swap's own [1m] request
    // could not use it — recovery still keys on class-level shelf liveness.
    await writeShelfSnapshot(shelf({ opus: [{ contextWindow: 999_999, model: "opus-model", provider: "OpusP", score: 55 }] }));
    const registry = registryFrom([
      providerSpec("OpusP", ["opus-model"], { credentials: [{ api_key: "sk-opus" }] })
    ]);

    assert.equal(await readSwapNotice({ modelRegistry: registry }), null);
  });
});

test("an actual step-down success records the reason safeguards and route fields", async () => {
  await withStepDownGateway(
    shelf({ sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] }),
    async () => {
      const plan = classPlan(REQUESTED_MODEL, sonnetRegistry());
      assert.equal(plan.attempts.length, 1);
      const target = plan.attempts[0].target;
      assert.ok(target);

      const notice = recordStepDownSuccess({
        credentialLabel: "cred-sonnet",
        hadRequestedClassFailure: false,
        requestedModel: REQUESTED_MODEL,
        servedModel: SERVED_MODEL,
        target
      });
      assert.ok(notice);
      assert.equal(notice.requestedClass, "opus");
      assert.equal(notice.servedClass, "sonnet");
      assert.equal(notice.model, "sonnet-live");
      assert.equal(notice.provider, "SonnetProvider");
      assert.equal(notice.credentialLabel, "cred-sonnet");
      assert.equal(notice.reason, "no live Opus triple");
      assert.equal(notice.safeguardsApplies, false);
      assert.equal(Number.isNaN(Date.parse(notice.sinceAt)), false);

      // A refusal leg ahead of the success changes the reason phrase.
      const refusalNotice = recordStepDownSuccess({
        credentialLabel: "cred-sonnet",
        hadRequestedClassFailure: true,
        requestedModel: REQUESTED_MODEL,
        servedModel: SERVED_MODEL,
        target
      });
      assert.ok(refusalNotice);
      assert.equal(refusalNotice.reason, "all Opus attempts refused before first token");
    }
  );
});

test("an actual Anthropic provider identity turns the safeguards note on", async () => {
  await withStepDownGateway(
    shelf({ sonnet: [{ model: "sonnet-live", provider: "AnthropicShim", score: 35 }] }),
    async () => {
      const anthropicSpec = providerSpec("AnthropicShim", ["sonnet-live"], { extra: { provider: "anthropic" } });
      const plan = classPlan(REQUESTED_MODEL, registryFrom([anthropicSpec]));
      const target = plan.attempts[0].target;
      assert.ok(target);

      const notice = recordStepDownSuccess({
        credentialLabel: "cred-sonnet",
        hadRequestedClassFailure: false,
        requestedModel: REQUESTED_MODEL,
        servedModel: "AnthropicShim/sonnet-live",
        target
      });
      assert.ok(notice);
      assert.equal(notice.safeguardsApplies, true);
    }
  );
});

test("same-class and non-provider successes record nothing", async () => {
  await withStepDownGateway(
    shelf({ opus: [{ model: "opus-model", provider: "OpusP", score: 55 }] }),
    async () => {
      const registry = registryFrom([
        providerSpec("OpusP", ["opus-model"], { credentials: [{ api_key: "sk-opus" }] })
      ]);
      const plan = classPlan(REQUESTED_MODEL, registry);
      const requestedTarget = plan.attempts[0].target;
      assert.ok(requestedTarget);

      assert.equal(
        recordStepDownSuccess({
          credentialLabel: "cred-opus",
          hadRequestedClassFailure: false,
          requestedModel: REQUESTED_MODEL,
          servedModel: "OpusP/opus-model",
          target: requestedTarget
        }),
        null
      );
      assert.equal(
        recordStepDownSuccess({
          credentialLabel: "cred-sonnet",
          hadRequestedClassFailure: false,
          requestedModel: REQUESTED_MODEL,
          servedModel: SERVED_MODEL,
          target: undefined
        }),
        null
      );
      assert.equal(await readSwapNotice({ modelRegistry: registry }), null);
    }
  );
});

test("recorded notices never carry the credential secret or request text", async () => {
  await withStepDownGateway(shelf(), async () => {
    recordSwapNotice(swapNoticeRecord());
    const notice = await readSwapNotice({ modelRegistry: sonnetRegistry() });
    assert.ok(notice);
    const noticeJson = JSON.stringify(notice);
    assert.doesNotMatch(noticeJson, new RegExp(FIXTURE_SECRET.replaceAll("-", "\\-")));
    assert.doesNotMatch(noticeJson, new RegExp(REQUEST_MARKER));
    assert.deepEqual(Object.keys(notice).sort(), [
      "credentialLabel",
      "model",
      "provider",
      "reason",
      "requestedClass",
      "safeguardsApplies",
      "servedClass",
      "sinceAt"
    ]);
  });
});

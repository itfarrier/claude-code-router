import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const previousRuntimeEnv = {
  appData: process.env.CCR_INTERNAL_APP_DATA_DIR,
  home: process.env.CCR_INTERNAL_HOME_DIR,
  userData: process.env.CCR_INTERNAL_USER_DATA_DIR
};
const runtimeRoot = mkdtempSync(path.join(os.tmpdir(), "ccr-web-management-test-"));
process.env.CCR_INTERNAL_APP_DATA_DIR = path.join(runtimeRoot, "app-data");
process.env.CCR_INTERNAL_HOME_DIR = path.join(runtimeRoot, "home");
process.env.CCR_INTERNAL_USER_DATA_DIR = path.join(runtimeRoot, "user-data");

after(() => {
  setOptionalEnv("CCR_INTERNAL_APP_DATA_DIR", previousRuntimeEnv.appData);
  setOptionalEnv("CCR_INTERNAL_HOME_DIR", previousRuntimeEnv.home);
  setOptionalEnv("CCR_INTERNAL_USER_DATA_DIR", previousRuntimeEnv.userData);
  rmSync(runtimeRoot, { force: true, recursive: true });
});

test("normalizeExternalHttpTarget accepts absolute http, https, and CCR plugin URLs only", async () => {
  const { normalizeExternalHttpTarget } = await import("@ccr/core/web/management-server.ts");
  assert.equal(normalizeExternalHttpTarget(""), undefined);
  assert.equal(normalizeExternalHttpTarget(undefined), undefined);
  assert.equal(normalizeExternalHttpTarget("about:blank"), undefined);
  assert.equal(normalizeExternalHttpTarget(" https://example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(normalizeExternalHttpTarget("http://localhost:3458/"), "http://localhost:3458/");
  assert.throws(() => normalizeExternalHttpTarget("file:///etc/passwd"), /Only http, https, and CCR plugin URLs/);
  assert.throws(() => normalizeExternalHttpTarget("javascript:alert(1)"), /Only http, https, and CCR plugin URLs/);
  assert.throws(() => normalizeExternalHttpTarget("example.com"), /valid absolute URL/);
});

test("web RPC ignores Origin and Referer when the auth token is valid", async () => {
  const { startWebManagementServer } = await import("@ccr/core/web/management-server.ts");
  const authToken = "test-web-auth-token";
  const runtime = await startWebManagementServer({
    authToken,
    host: "127.0.0.1",
    port: 0,
    startGateway: false
  });
  try {
    const endpoint = new URL("/api/ccr/rpc", runtime.url);
    const response = await fetch(endpoint, {
      body: JSON.stringify({ args: [], method: "getAppInfo" }),
      headers: {
        "content-type": "application/json",
        "origin": "http://127.0.0.1:8000",
        "referer": "http://127.0.0.1:8000/",
        "x-ccr-web-auth": authToken
      },
      method: "POST"
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.value.name, "Claude Code Router");
  } finally {
    await runtime.close();
  }
});

test("startGateway reuses an already healthy CCR gateway on the configured port", async () => {
  const { saveAppConfig } = await import("@ccr/core/config/config.ts");
  const { createDefaultAppConfig } = await import("@ccr/core/config/default-config.ts");
  const { gatewayRuntimeConfigRevision } = await import("@ccr/core/gateway/runtime-config-control.ts");
  const { gatewayService } = await import("@ccr/core/gateway/service.ts");
  const { startWebManagementServer } = await import("@ccr/core/web/management-server.ts");
  await gatewayService.stop();
  const gatewayPort = await findAvailablePort();
  const webAuthToken = "test-web-auth-token";
  const config = createDefaultAppConfig();
  config.gateway.port = gatewayPort;
  config.gateway.corePort = await findAvailablePort();
  config.Providers = [{
    api_base_url: "http://127.0.0.1:9/v1",
    api_key: "test-provider-key",
    id: "test-provider",
    models: ["test-model"],
    name: "Test Provider",
    type: "openai_chat_completions"
  }];
  const savedConfig = await saveAppConfig(config);
  const externalGatewayState = {
    reloadRequests: [],
    revision: gatewayRuntimeConfigRevision(savedConfig)
  };
  const externalGateway = createHealthyCcrGateway(savedConfig.APIKEY, externalGatewayState);
  await listen(externalGateway, gatewayPort);
  const runtime = await startWebManagementServer({
    authToken: webAuthToken,
    host: "127.0.0.1",
    port: 0,
    startGateway: false
  });
  const originalStart = gatewayService.start;
  let managedStarts = 0;
  gatewayService.start = async function (...args) {
    managedStarts += 1;
    return originalStart.apply(this, args);
  };

  try {
    const payload = await rpc(runtime.url, webAuthToken, "startGateway");

    assert.equal(payload.ok, true);
    assert.equal(payload.value.state, "running", payload.value.lastError);
    assert.equal(payload.value.endpoint, `http://127.0.0.1:${gatewayPort}`);
    assert.equal(payload.value.gatewayManagedExternally, true);
    assert.equal(gatewayService.getStatus().state, "running");
    assert.equal(gatewayService.getStatus().gatewayManagedExternally, true);
    assert.equal(managedStarts, 0, "existing gateways should be adopted without spawning a competing runtime");

    const secondStart = await rpc(runtime.url, webAuthToken, "startGateway");
    assert.equal(secondStart.ok, true);
    assert.equal(secondStart.value.endpoint, `http://127.0.0.1:${gatewayPort}`);
    assert.equal(secondStart.value.gatewayManagedExternally, true);
    assert.equal(managedStarts, 0);

    const nextConfig = structuredClone(savedConfig);
    nextConfig.Providers[0].name = "Updated Test Provider";
    const reloadCountBeforeSave = externalGatewayState.reloadRequests.length;
    const saveResult = await rpc(runtime.url, webAuthToken, "saveConfig", [nextConfig, { applyProfile: false }]);
    assert.equal(saveResult.ok, true);
    assert.equal(externalGatewayState.reloadRequests.length, reloadCountBeforeSave + 1);
    assert.equal(externalGatewayState.reloadRequests.at(-1).forceRestart, true);
    assert.equal(externalGatewayState.revision, gatewayRuntimeConfigRevision(saveResult.value));
    assert.equal(gatewayService.getStatus().gatewayManagedExternally, true);
  } finally {
    gatewayService.start = originalStart;
    await runtime.close();
    await gatewayService.stop();
    await closeServer(externalGateway);
  }
});

// Runs after the startGateway case: this test's notice read loads (and on a
// fresh store persists) the app config, and the startGateway case above saves
// a revisionless createDefaultAppConfig() that only succeeds against a
// not-yet-persisted config row.
// An adopted runtime is the notice source of truth: the local UI's
// getSwapNotice proxies the executing runtime's record through the
// authenticated runtime channel and reconciles with it. The "external
// runtime" here is the mock gateway process plus a real class-switch record
// produced in this process by the real planner + notice seam; the mock's
// /__ccr/runtime/swap-notice route serves the same seam read the fork's
// notice-runtime plugin serves.
test("an adopted runtime's swap notice reaches the local UI and reconciles", async () => {
  const { loadAppConfig, saveAppConfig } = await import("@ccr/core/config/config.ts");
  const { createDefaultAppConfig } = await import("@ccr/core/config/default-config.ts");
  const { writeShelfSnapshot } = await import("@ccr/core/class-switch/catalog.ts");
  const { recordStepDownSuccessFromTarget } = await import("@ccr/core/class-switch/seam.ts");
  const { createRouteExecutionPlan } = await import("@ccr/core/routing/execution-plan.ts");
  const { ModelRegistry } = await import("@ccr/core/routing/model-registry.ts");
  const { gatewayService } = await import("@ccr/core/gateway/service.ts");
  const { startWebManagementServer } = await import("@ccr/core/web/management-server.ts");
  const { setThinShareCounter } = await import("@ccr/core/class-switch/plan.ts");
  const { getSwapNotice } = await import("@ccr/core/class-switch/seam.ts");
  const { gatewayRuntimeConfigRevision } = await import("@ccr/core/gateway/runtime-config-control.ts");

  await gatewayService.stop();
  setThinShareCounter(0);
  const gatewayPort = await findAvailablePort();
  const webAuthToken = "test-web-auth-token";
  // Carry the current persisted revision: earlier tests in this file already
  // saved a config row, so a fresh default would hit the conflict guard.
  const currentConfig = await loadAppConfig();
  const baseConfig = currentConfig ?? createDefaultAppConfig();
  const config = {
    ...baseConfig,
    Providers: [{
      api_base_url: "https://upstream.example/v1",
      api_key: "test-provider-key",
      capabilities: [{ type: "anthropic_messages" }],
      credentials: [{ api_key: "sk-provider-secret", id: "cred:sonnet" }],
      models: ["sonnet-live", "opus-live"],
      name: "SonnetProvider",
      type: "anthropic_messages"
    }],
    gateway: {
      ...baseConfig.gateway,
      corePort: await findAvailablePort(),
      port: gatewayPort
    }
  };
  const savedConfig = await saveAppConfig(config);

  // The executing runtime's real step-down: an empty Opus shelf with one
  // Sonnet row, planned through the real planner, recorded through the real
  // notice seam.
  const registry = new ModelRegistry({ Providers: savedConfig.Providers, virtualModelProfiles: [] });
  await writeShelfSnapshot({
    excluded: [],
    review: [],
    shelves: { fable: [], haiku: [], opus: [], sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }] },
    updatedAt: new Date().toISOString()
  });
  const plan = createRouteExecutionPlan({
    bodyModel: "claude-opus-4-6",
    fallback: { mode: "off", models: [], retryCount: 0 },
    hasRequestBody: true,
    modelRegistry: registry,
    primaryModel: "claude-opus-4-6"
  });
  const target = plan.attempts[0]?.target;
  assert.ok(target);
  const recorded = recordStepDownSuccessFromTarget({
    credentialLabel: "cred:sonnet",
    hadRequestedClassFailure: false,
    requestedModel: "claude-opus-4-6",
    target
  });
  assert.ok(recorded);

  // The mock external gateway serves the swap-notice route the way the
  // notice-runtime plugin does: an authenticated read of the executing
  // runtime's own record through the real seam (with its own reconciliation).
  const swapNoticeState = { current: recorded };
  const externalGateway = createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/health") {
      sendJson(response, 200, { core: "http://127.0.0.1:3457", status: "running", timestamp: new Date().toISOString() });
      return;
    }
    if (url.pathname === "/") {
      sendJson(response, 200, { core: "next-ai-gateway", endpoints: ["GET /v1/models"], name: "claude-code-router", plugin: "claude-code-router" });
      return;
    }
    if (url.pathname === "/v1/models") {
      if (request.headers.authorization !== `Bearer ${savedConfig.APIKEY}`) {
        sendJson(response, 401, { error: { message: "Invalid API key." } });
        return;
      }
      sendJson(response, 200, { data: [{ id: "sonnet-live", object: "model" }], object: "list" });
      return;
    }
    if (url.pathname === "/__ccr/runtime/config") {
      if (request.headers.authorization !== `Bearer ${savedConfig.APIKEY}`) {
        sendJson(response, 401, { error: { message: "Invalid API key." } });
        return;
      }
      sendJson(response, 200, { revision: gatewayRuntimeConfigRevision(savedConfig), state: "running" });
      return;
    }
    if (url.pathname === "/__ccr/runtime/swap-notice") {
      if (request.headers.authorization !== `Bearer ${savedConfig.APIKEY}`) {
        sendJson(response, 401, { error: { message: "Invalid API key." } });
        return;
      }
      const readNotice = await getSwapNotice();
      swapNoticeState.current = readNotice;
      sendJson(response, 200, { notice: readNotice });
      return;
    }
    sendJson(response, 404, { error: { message: "Not found." } });
  });
  await listen(externalGateway, gatewayPort);
  const runtime = await startWebManagementServer({
    authToken: webAuthToken,
    host: "127.0.0.1",
    port: 0,
    startGateway: false
  });

  try {
    const start = await rpc(runtime.url, webAuthToken, "startGateway");
    assert.equal(start.ok, true);
    assert.equal(start.value.state, "running", start.value.lastError);
    assert.equal(start.value.gatewayManagedExternally, true);

    // The local UI's getSwapNotice returns the executing runtime's record
    // through the adopted channel and mirrors it into the local projection.
    const populated = await rpc(runtime.url, webAuthToken, "getSwapNotice");
    assert.equal(populated.ok, true);
    assert.ok(populated.value);
    assert.equal(populated.value.requestedClass, "opus");
    assert.equal(populated.value.servedClass, "sonnet");
    assert.equal(populated.value.model, "sonnet-live");
    assert.equal(populated.value.provider, "SonnetProvider");
    assert.equal(populated.value.credentialLabel, "cred:sonnet");

    // The executing runtime reconciles its own record (the Opus class has a
    // live triple again) → the next adopted read clears the local projection.
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        fable: [],
        haiku: [],
        opus: [{ model: "opus-live", provider: "SonnetProvider", score: 55 }],
        sonnet: [{ model: "sonnet-live", provider: "SonnetProvider", score: 35 }]
      },
      updatedAt: new Date().toISOString()
    });
    const reconciled = await rpc(runtime.url, webAuthToken, "getSwapNotice");
    assert.equal(reconciled.ok, true);
    assert.equal(reconciled.value, null);
  } finally {
    // The empty shelf snapshot is this file's baseline: later tests record a
    // notice and rely on the requested class staying not-live.
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { fable: [], haiku: [], opus: [], sonnet: [] },
      updatedAt: new Date().toISOString()
    });
    await runtime.close();
    await gatewayService.stop();
    await closeServer(externalGateway);
  }
});

test("authenticated web RPC returns the current swap notice", async () => {
  const { startWebManagementServer } = await import("@ccr/core/web/management-server.ts");
  const { clearSwapNotice, recordSwapNotice } = await import("@ccr/core/class-switch/notice.ts");
  const authToken = "test-web-auth-token";
  const swapNotice = {
    credentialLabel: "cred:sonnet",
    model: "sonnet-live",
    provider: "SonnetProvider",
    reason: "no live Opus triple",
    requestedClass: "opus",
    safeguardsApplies: false,
    servedClass: "sonnet",
    sinceAt: "2026-11-15T10:00:00.000Z"
  };
  const runtime = await startWebManagementServer({
    authToken,
    host: "127.0.0.1",
    port: 0,
    startGateway: false
  });
  try {
    recordSwapNotice(swapNotice);
    const endpoint = new URL("/api/ccr/rpc", runtime.url);
    const populated = await fetch(endpoint, {
      body: JSON.stringify({ args: [], method: "getSwapNotice" }),
      headers: {
        "content-type": "application/json",
        "x-ccr-web-auth": authToken
      },
      method: "POST"
    });
    const populatedPayload = await populated.json();

    assert.equal(populated.status, 200);
    assert.equal(populatedPayload.ok, true);
    assert.deepEqual(populatedPayload.value, swapNotice);

    const unauthorized = await fetch(endpoint, {
      body: JSON.stringify({ args: [], method: "getSwapNotice" }),
      headers: {
        "content-type": "application/json",
        "x-ccr-web-auth": "wrong-token"
      },
      method: "POST"
    });
    const unauthorizedPayload = await unauthorized.json();

    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorizedPayload.ok, false);

    clearSwapNotice();
    const cleared = await fetch(endpoint, {
      body: JSON.stringify({ args: [], method: "getSwapNotice" }),
      headers: {
        "content-type": "application/json",
        "x-ccr-web-auth": authToken
      },
      method: "POST"
    });
    const clearedPayload = await cleared.json();

    assert.equal(cleared.status, 200);
    assert.equal(clearedPayload.ok, true);
    assert.equal(clearedPayload.value, null);
  } finally {
    clearSwapNotice();
    await runtime.close();
  }
});

async function rpc(baseUrl, authToken, method, args = []) {
  const response = await fetch(new URL("/api/ccr/rpc", baseUrl), {
    body: JSON.stringify({ args, method }),
    headers: {
      "content-type": "application/json",
      "x-ccr-web-auth": authToken
    },
    method: "POST"
  });
  assert.equal(response.status, 200);
  return response.json();
}

function createHealthyCcrGateway(apiKey, state) {
  return createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/health") {
      sendJson(response, 200, {
        core: "http://127.0.0.1:3457",
        status: "running",
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (url.pathname === "/") {
      sendJson(response, 200, {
        core: "next-ai-gateway",
        endpoints: ["GET /v1/models"],
        name: "claude-code-router",
        plugin: "claude-code-router"
      });
      return;
    }
    if (url.pathname === "/v1/models") {
      if (request.headers.authorization !== `Bearer ${apiKey}`) {
        sendJson(response, 401, { error: { message: "Invalid API key." } });
        return;
      }
      sendJson(response, 200, { data: [{ id: "test-model", object: "model" }], object: "list" });
      return;
    }
    if (url.pathname === "/__ccr/runtime/config") {
      if (request.headers.authorization !== `Bearer ${apiKey}`) {
        sendJson(response, 401, { error: { message: "Invalid API key." } });
        return;
      }
      if (request.method === "GET") {
        sendJson(response, 200, { revision: state.revision, state: "running" });
        return;
      }
      if (request.method === "POST") {
        void readJsonRequest(request).then((body) => {
          state.reloadRequests.push(body);
          state.revision = body.configRevision;
          sendJson(response, 202, {
            accepted: true,
            configRevision: body.configRevision,
            restarting: body.forceRestart === true
          });
        });
        return;
      }
    }
    sendJson(response, 404, { error: { message: "Not found." } });
  });
}

async function readJsonRequest(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : undefined;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("Failed to allocate a web management test port."));
        }
      });
    });
  });
}

function setOptionalEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

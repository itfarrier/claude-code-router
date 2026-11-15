import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

// Isolate the user-data dir before importing any config-backed module: the
// adopted-notice reads reconcile against the app config and shelf snapshot.
const runtimeRoot = mkdtempSync(path.join(os.tmpdir(), "ccr-notice-runtime-test-"));
const previousUserDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
process.env.CCR_INTERNAL_USER_DATA_DIR = path.join(runtimeRoot, "user-data");

after(() => {
  setOptionalEnv("CCR_INTERNAL_USER_DATA_DIR", previousUserDataDir);
  rmSync(runtimeRoot, { force: true, recursive: true });
});

function setOptionalEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

// The adopted-runtime swap-notice plugin: one authenticated GET route on the
// executing runtime that reads its own notice record through the seam. The
// route registration is kill-switch and app-config gated, and the payload is
// the scalar-only SwapNotice.

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

function fakeReply() {
  const sent = [];
  const reply = {
    code(statusCode) {
      reply.statusCode = statusCode;
      return {
        send(payload) {
          sent.push(payload);
          return reply;
        }
      };
    },
    send(payload) {
      sent.push(payload);
      return reply;
    },
    sent,
    statusCode: 0
  };
  return reply;
}

test("the swap-notice runtime plugin exposes no route under the kill switch", async () => {
  const { createGatewayPlugin } = await import("@ccr/core/class-switch/notice-runtime.ts");
  const previous = process.env.CCR_CLASS_SWITCH;
  try {
    process.env.CCR_CLASS_SWITCH = "0";
    const plugin = await createGatewayPlugin({
      plugin: { config: { appConfig: { Providers: [] } } }
    });
    assert.deepEqual(plugin, {});
  } finally {
    if (previous === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previous;
    }
  }
});

test("the swap-notice runtime route reads the executing runtime's own record", async () => {
  const { clearSwapNotice, recordSwapNotice } = await import("@ccr/core/class-switch/notice.ts");
  const { createGatewayPlugin, gatewaySwapNoticeControlPath } = await import("@ccr/core/class-switch/notice-runtime.ts");
  clearSwapNotice();
  try {
    const plugin = await createGatewayPlugin({
      plugin: { config: { appConfig: { Providers: [] } } }
    });
    const routes = plugin.httpRoutes;
    assert.ok(Array.isArray(routes) && routes.length === 1);
    const route = routes[0];
    assert.equal(route.key, "ccr-class-switch-swap-notice");
    assert.equal(route.method, "GET");
    assert.equal(route.path, gatewaySwapNoticeControlPath);
    assert.equal(route.path, "/__ccr/runtime/swap-notice");
    // The runtime's own static key auth covers the route; the handler only
    // reads and reconciles the local record.
    assert.equal(route.auth, "gateway");
    assert.equal(typeof route.handler, "function");

    recordSwapNotice(swapNotice);
    const reply = fakeReply();
    await route.handler({ request: { headers: {} }, reply });
    assert.equal(reply.statusCode, 200);
    assert.deepEqual(reply.sent[0], { notice: swapNotice });

    clearSwapNotice();
    const emptyReply = fakeReply();
    await route.handler({ request: { headers: {} }, reply: emptyReply });
    assert.equal(emptyReply.statusCode, 200);
    assert.deepEqual(emptyReply.sent[0], { notice: null });
  } finally {
    clearSwapNotice();
  }
});

test("the swap-notice runtime plugin requires the compiled app config", async () => {
  const { createGatewayPlugin } = await import("@ccr/core/class-switch/notice-runtime.ts");
  assert.deepEqual(await createGatewayPlugin({}), {});
  assert.deepEqual(await createGatewayPlugin({ plugin: { config: {} } }), {});
  assert.deepEqual(await createGatewayPlugin({ plugin: { config: { appConfig: {} } } }), {});
});

test("the managing side mirrors the external record into the local projection", async () => {
  const { clearSwapNotice, recordSwapNotice, readSwapNotice } = await import("@ccr/core/class-switch/notice.ts");
  const { createServer } = await import("node:http");
  const net = await import("node:net");
  const { readExternalRuntimeSwapNotice } = await import("@ccr/core/class-switch/notice-runtime.ts");
  clearSwapNotice();
  const originalFetch = globalThis.fetch;

  const port = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === "object" && address ? address.port : undefined));
    });
  });
  assert.ok(port);

  const external = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/__ccr/runtime/swap-notice") {
      if (request.headers.authorization !== "Bearer runtime-key") {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "Unauthorized." } }));
        return;
      }
      // The external runtime's current record (its own reconciliation result).
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ notice: state.externalNotice ?? null }));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Not found." } }));
  });
  const state = { externalNotice: structuredClone(swapNotice) };
  await new Promise((resolve) => external.listen(port, "127.0.0.1", resolve));

  try {
    // The adopted read returns and mirrors the external record.
    const notice = await readExternalRuntimeSwapNotice({ apiKey: "runtime-key", endpoint: `http://127.0.0.1:${port}` });
    assert.ok(notice);
    assert.equal(notice.servedClass, "sonnet");
    assert.deepEqual(await readSwapNotice(), swapNotice);

    // The executing runtime reconciled (cleared) its record → the local
    // projection clears with the next adopted read.
    state.externalNotice = null;
    const cleared = await readExternalRuntimeSwapNotice({ apiKey: "runtime-key", endpoint: `http://127.0.0.1:${port}` });
    assert.equal(cleared, null);
    assert.equal(await readSwapNotice(), null);

    // An unusable channel falls back to the local projection untouched.
    recordSwapNotice(swapNotice);
    globalThis.fetch = async () => {
      throw new Error("connection refused");
    };
    const fallback = await readExternalRuntimeSwapNotice({ apiKey: "runtime-key", endpoint: `http://127.0.0.1:${port}` });
    assert.deepEqual(fallback, swapNotice);
    assert.deepEqual(await readSwapNotice(), swapNotice);

    // Without an API key the local projection is the only source.
    const keyless = await readExternalRuntimeSwapNotice({ endpoint: `http://127.0.0.1:${port}` });
    assert.deepEqual(keyless, swapNotice);
  } finally {
    globalThis.fetch = originalFetch;
    clearSwapNotice();
    await new Promise((resolve) => external.close(resolve));
  }
});

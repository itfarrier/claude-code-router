import assert from "node:assert/strict";
import test, { after } from "node:test";

type SwapNoticeFixture = {
  credentialLabel: string;
  model: string;
  provider: string;
  reason: string;
  requestedClass: "fable" | "opus" | "sonnet" | "haiku";
  safeguardsApplies: boolean;
  servedClass: "fable" | "opus" | "sonnet" | "haiku";
  sinceAt: string;
};

const swapNotice: SwapNoticeFixture = {
  credentialLabel: "cred:sonnet",
  model: "sonnet-live",
  provider: "SonnetProvider",
  reason: "no live Opus triple",
  requestedClass: "opus",
  safeguardsApplies: false,
  servedClass: "sonnet",
  sinceAt: "2026-11-15T10:00:00.000Z"
};

const previousWindow = (globalThis as { window?: unknown }).window;
const previousFetch = globalThis.fetch;

// Isolated browser globals. window.ccr must be absent before the dynamic
// bridge import so the module's own install path runs, and the location,
// history, and sessionStorage shapes are the values readWebAuthToken consumes.
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    addEventListener: () => undefined,
    cancelAnimationFrame: () => undefined,
    clearInterval: () => undefined,
    history: { replaceState: () => undefined },
    location: { href: "http://127.0.0.1:3458/pages/home/index.html", pathname: "/pages/home/index.html", search: "" },
    matchMedia: () => ({
      addEventListener: () => undefined,
      matches: false,
      removeEventListener: () => undefined
    }),
    removeEventListener: () => undefined,
    requestAnimationFrame: () => 0,
    sessionStorage: {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined
    },
    setInterval: () => 0
  }
});

const bridge = () => window.ccr as unknown as {
  getSwapNotice?: () => Promise<SwapNoticeFixture | null>;
};

test("web bridge reads getSwapNotice with no arguments", async () => {
  // The dynamic import must run after the isolated globals install: the module
  // reads window.location/sessionStorage at evaluation time and installs
  // window.ccr when absent.
  await import("@ccr/ui/web-client-bridge.ts");
  assert.equal(typeof bridge().getSwapNotice, "function");

  const requests: Array<{ body: string; endpoint: string; headers: Record<string, string> }> = [];
  const stubFetch = async (input: unknown, init?: { body?: string; headers?: Record<string, string>; method?: string }) => {
    const url = typeof input === "string" ? input : String((input as { url: string }).url);
    requests.push({
      body: init?.body ?? "",
      endpoint: url,
      headers: { ...(init?.headers ?? {}) }
    });
    return new Response(JSON.stringify({ ok: true, value: swapNotice }), {
      headers: { "content-type": "application/json" },
      status: 200
    });
  };
  globalThis.fetch = stubFetch as typeof globalThis.fetch;

  const populated = await bridge().getSwapNotice();

  assert.equal(requests.length, 1);
  assert.equal(new URL(requests[0].endpoint).pathname, "/api/ccr/rpc");
  assert.equal(requests[0].headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(requests[0].body), { args: [], method: "getSwapNotice" });
  assert.deepEqual(populated, swapNotice);

  const nullFetch = async () => new Response(JSON.stringify({ ok: true, value: null }), {
    headers: { "content-type": "application/json" },
    status: 200
  });
  globalThis.fetch = nullFetch as typeof globalThis.fetch;

  const cleared = await bridge().getSwapNotice();
  assert.equal(cleared, null);
});

after(() => {
  globalThis.fetch = previousFetch;
  if (previousWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow
    });
  }
});

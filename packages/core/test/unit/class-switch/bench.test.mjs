import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeShelfSnapshot } from "@ccr/core/class-switch/catalog.ts";
import {
  benchSnapshotPath,
  benchRowUntil,
  isBenched,
  recordClassRefusal,
  recordClassSuccess,
  resetClassSwitchBenchForTest,
  startBench,
  stopBench
} from "@ccr/core/class-switch/bench.ts";
import { start as startSeam, stop as stopSeam } from "@ccr/core/class-switch/seam.ts";

const FIXED_NOW = 1_700_000_000_000;

function oneShotSchedule(schedules) {
  return (delayMs, run) => {
    schedules?.push(delayMs);
    if (!oneShotSchedule.ran) {
      oneShotSchedule.ran = true;
      queueMicrotask(() => void run());
    }
  };
}
oneShotSchedule.ran = false;

function hdr(map) {
  return new Headers(map);
}

function benchImport() {
  return import("@ccr/core/class-switch/bench.ts");
}

async function withBenchEnv(run) {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const previousSwitch = process.env.CCR_CLASS_SWITCH;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-bench-test-"));
  process.env.CCR_INTERNAL_USER_DATA_DIR = dir;
  process.env.CCR_CLASS_SWITCH = "1";
  oneShotSchedule.ran = false;
  try {
    resetClassSwitchBenchForTest();
    await run(dir);
  } finally {
    stopBench();
    rmSync(dir, { force: true, recursive: true });
    if (previousDataDir === undefined) {
      delete process.env.CCR_INTERNAL_USER_DATA_DIR;
    } else {
      process.env.CCR_INTERNAL_USER_DATA_DIR = previousDataDir;
    }
    if (previousSwitch === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previousSwitch;
    }
    resetClassSwitchBenchForTest();
  }
}

function emptyShelves() {
  return { fable: [], haiku: [], opus: [], sonnet: [] };
}

async function refuse(input) {
  const mod = await benchImport();
  mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
  await recordClassRefusal(
    input.status,
    input.provider,
    input.model,
    input.credentialId,
    input.headers,
    input.body
  );
}

test("retry-after seconds park that credential on that model", async () => {
  await withBenchEnv(async () => {
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    await recordClassRefusal(
      429,
      "openrouter",
      "nvidia/nemotron-3",
      "cred:third",
      hdr({ "retry-after": "120" })
    );
    assert.equal(benchRowUntil("openrouter", "cred:third", "nvidia/nemotron-3"), FIXED_NOW + 120_000);
  });
});

test("retry-after HTTP-date parks until that instant", async () => {
  await withBenchEnv(async () => {
    const untilInstant = FIXED_NOW + 90_000;
    const httpDate = new Date(untilInstant).toUTCString();
    await refuse({
      status: 429,
      provider: "groq",
      model: "llama",
      credentialId: "cred:a",
      headers: hdr({ "retry-after": httpDate })
    });
    assert.equal(benchRowUntil("groq", "cred:a", "llama"), untilInstant);
  });
});

test("x-ratelimit-reset 13 digits is Unix milliseconds", async () => {
  await withBenchEnv(async () => {
    const resetAt = FIXED_NOW + 180_000;
    await refuse({
      status: 429,
      provider: "openrouter",
      model: "m1",
      credentialId: "cred:b",
      headers: hdr({ "x-ratelimit-reset": String(resetAt) })
    });
    assert.equal(benchRowUntil("openrouter", "cred:b", "m1"), resetAt);
  });
});

test("x-ratelimit-reset 10 digits is Unix seconds", async () => {
  await withBenchEnv(async () => {
    const resetAt = FIXED_NOW + 150_000;
    await refuse({
      status: 429,
      provider: "openrouter",
      model: "m2",
      credentialId: "cred:c",
      headers: hdr({ "x-ratelimit-reset": String(Math.floor(resetAt / 1000)) })
    });
    assert.equal(benchRowUntil("openrouter", "cred:c", "m2"), resetAt);
  });
});

test("resets_at ISO-8601 in JSON parks until that time", async () => {
  await withBenchEnv(async () => {
    const iso = new Date(FIXED_NOW + 200_000).toISOString();
    await refuse({
      status: 403,
      provider: "openrouter",
      model: "m3",
      credentialId: "cred:d",
      headers: hdr(),
      body: { error: { metadata: { resets_at: iso } } }
    });
    const until = benchRowUntil("openrouter", "cred:d", "*");
    assert.ok(until !== undefined);
    assert.equal(until, Math.floor(new Date(iso).getTime() / 60_000) * 60_000);
  });
});

test("next_flush_time in JSON parks until that time", async () => {
  await withBenchEnv(async () => {
    const ms = FIXED_NOW + 240_000;
    await refuse({
      status: 429,
      provider: "p",
      model: "m4",
      credentialId: "cred:e",
      headers: hdr(),
      body: { next_flush_time: ms }
    });
    assert.equal(benchRowUntil("p", "cred:e", "m4"), ms);
  });
});

test("Groq duration 2m59.56s is from now not sixty seconds", async () => {
  await withBenchEnv(async () => {
    await refuse({
      status: 429,
      provider: "groq",
      model: "m5",
      credentialId: "cred:f",
      headers: hdr({
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "2m59.56s"
      })
    });
    const until = benchRowUntil("groq", "cred:f", "m5");
    const expected = FIXED_NOW + 2 * 60_000 + 59_560;
    assert.ok(until !== undefined);
    assert.ok(Math.abs(until - expected) < 5);
    assert.notEqual(until, FIXED_NOW + 60_000);
  });
});

test("a time only in error message writes no until from that string", async () => {
  await withBenchEnv(async () => {
    const lines = [];
    const previous = console.info;
    console.info = (...args) => lines.push(args.join(" "));
    try {
      await refuse({
        status: 429,
        provider: "p",
        model: "m6",
        credentialId: "cred:g",
        headers: hdr(),
        body: { error: { message: "Try again at Wed, 21 Oct 2030 07:28:00 GMT" } }
      });
    } finally {
      console.info = previous;
    }
    assert.equal(benchRowUntil("p", "cred:g", "m6"), FIXED_NOW + 60_000);
    assert.ok(lines.some((line) => line.includes("no-provider-time")));
  });
});

test("401 with no time parks every model of that credential for five minutes", async () => {
  await withBenchEnv(async () => {
    await refuse({
      status: 401,
      provider: "groq",
      model: "any",
      credentialId: "cred:h",
      headers: hdr()
    });
    assert.equal(benchRowUntil("groq", "cred:h", "*"), FIXED_NOW + 5 * 60_000);
  });
});

test("403 with no time sets probe false and logs fix-key", async () => {
  await withBenchEnv(async () => {
    const lines = [];
    const previous = console.info;
    console.info = (...args) => lines.push(args.join(" "));
    try {
      await refuse({ status: 403, provider: "openrouter", model: "m7", credentialId: "cred:i", headers: hdr() });
      const mod = await benchImport();
      assert.equal(mod.benchProbeAllowedForTest("openrouter", "cred:i"), false);
      assert.ok(lines.some((line) => line.includes("fix-key") && line.includes("openrouter") && line.includes("cred:i")));
    } finally {
      console.info = previous;
    }
  });
});

test("404 parks model on every credential at that provider for one hour", async () => {
  await withBenchEnv(async () => {
    await refuse({ status: 404, provider: "BenchProvider", model: "alpha/model-a", credentialId: "cred:j", headers: hdr() });
    assert.equal(benchRowUntil("BenchProvider", "*", "alpha/model-a"), FIXED_NOW + 60 * 60_000);
    assert.equal(isBenched("OtherProvider", "alpha/model-a"), false);
  });
});

test("5xx parks provider model for thirty seconds", async () => {
  await withBenchEnv(async () => {
    await recordClassRefusal(503, "BenchProvider", "beta/model-b");
    assert.equal(benchRowUntil("BenchProvider", "*", "beta/model-b"), FIXED_NOW + 30_000);
    assert.equal(isBenched("BenchProvider", "beta/model-b"), true);
  });
});

test("400 writes no bench row", async () => {
  await withBenchEnv(async () => {
    await refuse({ status: 400, provider: "p", model: "m8", credentialId: "cred:k", headers: hdr() });
    assert.throws(() => readFileSync(benchSnapshotPath(), "utf8"));
    assert.equal(isBenched("p", "m8"), false);
  });
});

test("remaining requests zero uses paired Groq duration", async () => {
  await withBenchEnv(async () => {
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    await recordClassSuccess("groq", "m9", "cred:l", {
      headers: hdr({
        "x-ratelimit-remaining-requests": "0",
        "x-ratelimit-reset-requests": "7.66s"
      }),
      durationMs: 12
    });
    const until = benchRowUntil("groq", "cred:l", "m9");
    // A minute-less Groq duration parks for the real 7.66 seconds, not the
    // sixty-second no-clock fallback.
    const expected = FIXED_NOW + 7_660;
    assert.ok(until !== undefined);
    assert.ok(Math.abs(until - expected) < 5, `until ${until} is not the 7.66s reset`);
    assert.notEqual(until, FIXED_NOW + 60_000);
  });
});

test("bench module has no freeTierRequestsPerMinute export", async () => {
  const mod = await benchImport();
  assert.equal("freeTierRequestsPerMinute" in mod, false);
});

test("shelf model with no fresh time is due between sixty and one twenty seconds", async () => {
  await withBenchEnv(async (dir) => {
    const probeCalls = [];
    const schedules = [];
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        ...emptyShelves(),
        opus: [{ provider: "BenchProvider", model: "alpha/model-a", score: 50 }]
      },
      updatedAt: new Date().toISOString()
    });
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    startBench(
      { Providers: [{ name: "BenchProvider", models: ["alpha/model-a"], credentials: [{ credentialId: "cred:m", enabled: true, api_key: "sk-test" }] }] },
      {
        now: () => FIXED_NOW,
        schedule: oneShotSchedule(schedules),
        probeProvider: async (request) => {
          probeCalls.push(request);
          return { capabilities: [], models: [], protocols: [] };
        }
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    stopBench();
    assert.ok(schedules.includes(30_000));
    const dueAt = mod.benchDueAtForTest?.("BenchProvider", "alpha/model-a");
    assert.ok(dueAt !== undefined);
    const delta = dueAt - FIXED_NOW;
    assert.ok(delta >= 60_000 && delta <= 120_000);
  });
});

test("a future until is the next probe time", async () => {
  await withBenchEnv(async () => {
    const future = FIXED_NOW + 600_000;
    const probeCalls = [];
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { ...emptyShelves(), opus: [{ provider: "BenchProvider", model: "alpha/model-a" }] },
      updatedAt: new Date().toISOString()
    });
    await recordClassRefusal(429, "BenchProvider", "alpha/model-a", "cred:n", hdr(), {
      metadata: { headers: { "x-ratelimit-reset": String(future) } }
    });
    startBench(
      { Providers: [{ name: "BenchProvider", models: ["alpha/model-a"], credentials: [{ credentialId: "cred:n", api_key: "sk" }] }] },
      {
        now: () => FIXED_NOW,
        schedule: oneShotSchedule(),
        probeProvider: async (r) => {
          probeCalls.push(r);
          return { capabilities: [], models: [], protocols: [] };
        }
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    stopBench();
    assert.equal(probeCalls.length, 0);
    assert.equal(mod.benchNextProbeAtForTest("BenchProvider", "alpha/model-a"), future);
  });
});

test("remaining requests eleven skips the extra probe", async () => {
  await withBenchEnv(async () => {
    const probeCalls = [];
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { ...emptyShelves(), opus: [{ provider: "BenchProvider", model: "alpha/model-a" }] },
      updatedAt: new Date().toISOString()
    });
    await recordClassSuccess("BenchProvider", "alpha/model-a", "cred:o", {
      headers: hdr({
        "x-ratelimit-remaining-requests": "11",
        "x-ratelimit-reset-requests": "2m0s"
      }),
      durationMs: 50
    });
    startBench(
      { Providers: [{ name: "BenchProvider", models: ["alpha/model-a"], credentials: [{ credentialId: "cred:o", api_key: "sk" }] }] },
      {
        now: () => FIXED_NOW,
        schedule: oneShotSchedule(),
        probeProvider: async (r) => {
          probeCalls.push(r);
          return { capabilities: [], models: [], protocols: [] };
        }
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    stopBench();
    assert.equal(probeCalls.length, 0);
  });
});

test("2xx clears only that triple park", async () => {
  await withBenchEnv(async () => {
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW);
    await recordClassRefusal(429, "p", "m10", "cred:p", hdr({ "retry-after": "60" }));
    await recordClassRefusal(429, "p", "m10", "cred:q", hdr({ "retry-after": "60" }));
    await recordClassSuccess("p", "m10", "cred:p", { headers: hdr(), durationMs: 10 });
    assert.equal(benchRowUntil("p", "cred:p", "m10"), undefined);
    assert.equal(benchRowUntil("p", "cred:q", "m10"), FIXED_NOW + 60_000);
  });
});

test("probe uses mode connectivity and one model", async () => {
  await withBenchEnv(async () => {
    const probeCalls = [];
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW + 130_000);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { ...emptyShelves(), opus: [{ provider: "BenchProvider", model: "alpha/model-a" }] },
      updatedAt: new Date().toISOString()
    });
    mod.markShelfDueForTest?.("BenchProvider", "alpha/model-a", FIXED_NOW);
    startBench(
      { Providers: [{ name: "BenchProvider", models: ["alpha/model-a"], credentials: [{ credentialId: "cred:r", api_key: "sk" }] }] },
      {
        now: () => FIXED_NOW + 130_000,
        schedule: oneShotSchedule(),
        probeProvider: async (request) => {
          probeCalls.push(request);
          return { capabilities: [], models: [], protocols: [] };
        }
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    stopBench();
    assert.equal(probeCalls.length, 1);
    assert.equal(probeCalls[0].mode, "connectivity");
    assert.equal(probeCalls[0].forceRefresh, true);
    assert.deepEqual(probeCalls[0].models, ["alpha/model-a"]);
    assert.notEqual(probeCalls[0].mode, "models");
  });
});

test("probe false row is not passed to the probe mock", async () => {
  await withBenchEnv(async () => {
    const probeCalls = [];
    await refuse({ status: 403, provider: "BenchProvider", model: "alpha/model-a", credentialId: "cred:s", headers: hdr() });
    const mod = await benchImport();
    mod.setClassSwitchBenchNowForTest?.(() => FIXED_NOW + 200_000);
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: { ...emptyShelves(), opus: [{ provider: "BenchProvider", model: "alpha/model-a" }] },
      updatedAt: new Date().toISOString()
    });
    startBench(
      { Providers: [{ name: "BenchProvider", models: ["alpha/model-a"], credentials: [{ credentialId: "cred:s", api_key: "sk" }] }] },
      {
        now: () => FIXED_NOW + 200_000,
        schedule: oneShotSchedule(),
        probeProvider: async (r) => {
          probeCalls.push(r);
          return { capabilities: [], models: [], protocols: [] };
        }
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    stopBench();
    assert.equal(probeCalls.length, 0);
  });
});

test("CCR_CLASS_SWITCH zero does not start the bench timer", async () => {
  await withBenchEnv(async () => {
    process.env.CCR_CLASS_SWITCH = "0";
    const mod = await benchImport();
    let scheduled = false;
    startBench({ Providers: [] }, { schedule: () => { scheduled = true; } });
    assert.equal(scheduled, false);
    stopBench();
    const config = { Providers: [{ name: "BenchProvider", models: [], credentials: [] }] };
    startSeam(config);
    assert.equal(scheduled, false);
    stopSeam();
  });
});

test("a bad bench file loads as an empty table", async () => {
  await withBenchEnv(async (dir) => {
    const file = benchSnapshotPath();
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, "not-json{{{", "utf8");
    resetClassSwitchBenchForTest();
    assert.equal(isBenched("p", "m"), false);
  });
});
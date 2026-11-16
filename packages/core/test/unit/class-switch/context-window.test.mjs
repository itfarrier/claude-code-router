import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  contextWindowForProviderModel,
  writeShelfSnapshot
} from "@ccr/core/class-switch/catalog.ts";
import { applyContextWindows } from "@ccr/core/class-switch/seam.ts";
import { createGatewayModelsResponse } from "@ccr/core/gateway/features/model-discovery.ts";

function gatewayConfig(overrides = {}) {
  return {
    Providers: [
      {
        models: ["window-model"],
        name: "TestProvider",
        type: "openai_chat_completions",
        ...overrides.provider
      }
    ],
    profile: { enabled: true, profiles: [] },
    virtualModelProfiles: [],
    ...overrides
  };
}

function createClaudeCodeModelsResponse(config) {
  return createGatewayModelsResponse(config, { "user-agent": "claude-cli/2.1.215" });
}

test("gateway models expose a 272000 context window", () => {
  const config = gatewayConfig({
    provider: {
      modelMetadata: {
        "window-model": { contextWindow: 272_000 }
      }
    }
  });
  const response = createClaudeCodeModelsResponse(config);
  const model = response.data[0];
  assert.ok(model);
  assert.equal(model.context_window, 272_000);
  assert.equal(model.max_context_window, 272_000);
  assert.notEqual(model.context_window, 200_000);
});

test("OpenAI-shaped gateway models add only top-level context window fields", () => {
  const config = gatewayConfig({
    provider: {
      modelMetadata: {
        "window-model": { contextWindow: 272_000 }
      }
    }
  });
  const response = createGatewayModelsResponse(config, { "user-agent": "curl/8.0" });
  const model = response.data.find((row) => row.id === "TestProvider/window-model");
  assert.ok(model);
  assert.equal(model.context_window, 272_000);
  assert.equal(model.max_context_window, 272_000);
  // Upstream v3.1.5 natively emits max_input_tokens on the OpenAI-compatible
  // list; the fork's guarantee stays "top-level only, never nested".
  assert.equal(model.max_input_tokens, 272_000);
  assert.equal(model.capabilities, undefined);
});

test("Claude user-agent fills nested max_input_tokens when capabilities already exist", () => {
  const config = gatewayConfig({
    provider: {
      modelMetadata: {
        "window-model": { contextWindow: 272_000 }
      }
    }
  });
  const model = createClaudeCodeModelsResponse(config).data[0];
  assert.equal(model.max_input_tokens, 272_000);
  assert.equal(model.capabilities.context_window.max_input_tokens, 272_000);
  assert.equal(model.capabilities.context_management.max_input_tokens, 272_000);
});

test("unknown context window adds no invented window", () => {
  const config = gatewayConfig({
    provider: {
      models: ["no-window"],
      modelMetadata: {}
    }
  });
  const model = createClaudeCodeModelsResponse(config).data[0];
  // Upstream v3.1.5 emits its fields unconditionally (0 for an unknown model);
  // the fork's guarantee is that no window is invented for an unknown model.
  assert.ok(!model.context_window);
  assert.ok(!model.max_context_window);
  assert.notEqual(model.context_window, 200_000);
});

test("CCR_CLASS_SWITCH=0 keeps the models response at parent behavior including native context fields", () => {
  const previous = process.env.CCR_CLASS_SWITCH;
  const config = gatewayConfig({
    provider: {
      modelMetadata: {
        "window-model": { contextWindow: 272_000 }
      }
    }
  });
  try {
    process.env.CCR_CLASS_SWITCH = "0";
    const model = createClaudeCodeModelsResponse(config).data[0];
    // Upstream v3.1.5 natively emits these fields from modelMetadata; with the
    // kill switch on, the fork's seam must return that response untouched.
    assert.equal(model.context_window, 272_000);
    assert.equal(model.max_context_window, 272_000);
  } finally {
    if (previous === undefined) {
      delete process.env.CCR_CLASS_SWITCH;
    } else {
      process.env.CCR_CLASS_SWITCH = previous;
    }
  }
});

test("contextWindowForProviderModel applies effective percent when not pinned", () => {
  assert.equal(
    contextWindowForProviderModel({
      metadata: { contextWindow: 1_000_000, effectiveContextWindowPercent: 50 }
    }),
    500_000
  );
});

test("contextWindowForProviderModel respects contextWindowPinned", () => {
  assert.equal(
    contextWindowForProviderModel({
      metadata: {
        contextWindow: 1_000_000,
        contextWindowPinned: true,
        effectiveContextWindowPercent: 50
      }
    }),
    1_000_000
  );
});

test("contextWindowForProviderModel prefers catalog max over OpenRouter lengths", () => {
  assert.equal(
    contextWindowForProviderModel({
      catalogMaxInputTokens: 400_000,
      openRouterContextLength: 300_000,
      openRouterTopProviderContextLength: 350_000
    }),
    400_000
  );
});

test("snapshot-only overlay updates supported and supports_1m_context flags", async () => {
  const previousDataDir = process.env.CCR_INTERNAL_USER_DATA_DIR;
  const dir = mkdtempSync(path.join(tmpdir(), "ccr-class-switch-window-"));
  const config = gatewayConfig({
    provider: {
      models: ["snap-win"],
      modelMetadata: {}
    }
  });
  try {
    process.env.CCR_INTERNAL_USER_DATA_DIR = dir;
    await writeShelfSnapshot({
      excluded: [],
      review: [],
      shelves: {
        fable: [],
        haiku: [],
        opus: [{ contextWindow: 1_048_576, model: "snap-win", provider: "TestProvider" }],
        sonnet: []
      },
      updatedAt: new Date().toISOString()
    });
    const response = applyContextWindows(
      {
        data: [
          {
            capabilities: {
              context_management: { max_input_tokens: 0, supported: false, supports_1m_context: false },
              context_window: { max_input_tokens: 0, supported: false, supports_1m_context: false }
            },
            context_window: 0,
            id: "TestProvider/snap-win",
            max_context_window: 0,
            max_input_tokens: 0
          }
        ]
      },
      config
    );
    const model = response.data[0];
    assert.equal(model.max_input_tokens, 1_048_576);
    assert.equal(model.capabilities.context_window.supported, true);
    assert.equal(model.capabilities.context_window.supports_1m_context, true);
    assert.equal(model.capabilities.context_management.supported, true);
    assert.equal(model.capabilities.context_management.supports_1m_context, true);
  } finally {
    rmSync(dir, { force: true, recursive: true });
    if (previousDataDir === undefined) {
      delete process.env.CCR_INTERNAL_USER_DATA_DIR;
    } else {
      process.env.CCR_INTERNAL_USER_DATA_DIR = previousDataDir;
    }
  }
});

test("contextWindowForProviderModel falls back to OpenRouter context lengths", () => {
  assert.equal(
    contextWindowForProviderModel({
      openRouterContextLength: 262_144
    }),
    262_144
  );
  assert.equal(
    contextWindowForProviderModel({
      openRouterTopProviderContextLength: 131_072
    }),
    131_072
  );
});
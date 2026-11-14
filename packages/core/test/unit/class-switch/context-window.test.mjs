import assert from "node:assert/strict";
import test from "node:test";
import {
  contextWindowForProviderModel
} from "@ccr/core/class-switch/catalog.ts";
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
  assert.equal(model.max_input_tokens, undefined);
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

test("unknown context window does not add context_window fields", () => {
  const config = gatewayConfig({
    provider: {
      models: ["no-window"],
      modelMetadata: {}
    }
  });
  const model = createClaudeCodeModelsResponse(config).data[0];
  assert.equal(model.context_window, undefined);
  assert.equal(model.max_context_window, undefined);
  assert.notEqual(model.context_window, 200_000);
});

test("CCR_CLASS_SWITCH=0 leaves models response without new context window fields", () => {
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
    assert.equal(model.context_window, undefined);
    assert.equal(model.max_context_window, undefined);
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
import type { AppConfig, SwapNotice, SwapNoticeClass } from "@ccr/core/contracts/app";
import { clearSwapNotice, readSwapNotice, recordSwapNotice } from "@ccr/core/class-switch/notice";
import { isRecord } from "@ccr/core/gateway/internal/value";
import { modelRegistryForConfig } from "@ccr/core/routing/model-registry";

// Adopted-runtime swap-notice channel (CR-05). When the gateway is managed
// externally, requests execute in another process's pipeline, so that
// executing runtime owns the notice record. This module gives the executing
// runtime one authenticated route to read its own record, and gives the
// managing process one function to read it through. The payload stays the
// scalar-only SwapNotice; no provider config, credential secret, request
// body, or error text crosses the channel in either direction.

export const gatewaySwapNoticeControlPath = "/__ccr/runtime/swap-notice";
export const classSwitchSwapNoticeRuntimePluginKey = "ccr-class-switch-swap-notice";

type PluginHeaderValue = string | string[] | undefined;
type PluginHttpRequest = {
  body?: unknown;
  headers?: Record<string, PluginHeaderValue>;
  method?: string;
  url?: string;
};
type PluginHttpReply = {
  code(statusCode: number): {
    send(payload: unknown): unknown;
  };
  send(payload: unknown): unknown;
};

const swapNoticeClasses: SwapNoticeClass[] = ["fable", "haiku", "opus", "sonnet"];

function isSwapNotice(value: unknown): value is SwapNotice {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.credentialLabel === "string" &&
    typeof value.model === "string" &&
    typeof value.provider === "string" &&
    typeof value.reason === "string" &&
    swapNoticeClasses.includes(value.requestedClass as SwapNoticeClass) &&
    typeof value.safeguardsApplies === "boolean" &&
    swapNoticeClasses.includes(value.servedClass as SwapNoticeClass) &&
    typeof value.sinceAt === "string";
}

function readPluginAppConfig(pluginConfig: unknown): AppConfig | undefined {
  if (!isRecord(pluginConfig)) {
    return undefined;
  }
  const appConfig = pluginConfig.appConfig;
  if (!isRecord(appConfig) || !Array.isArray(appConfig.Providers)) {
    return undefined;
  }
  return appConfig as AppConfig;
}

// The executing runtime's plugin: one authenticated GET route that reads the
// runtime's own notice record (with class-level reconciliation, so polling
// this route is also what clears the record when the class is live again).
// `auth: "gateway"` reuses the runtime's own static API key auth — the same
// keys the adoption probe and every other gateway-authenticated route accept.
export async function createGatewayPlugin(input: {
  config?: Record<string, unknown>;
  plugin?: { config?: Record<string, unknown> };
} = {}): Promise<Record<string, unknown>> {
  if (process.env.CCR_CLASS_SWITCH === "0") {
    return {};
  }
  const appConfig = readPluginAppConfig(input.plugin?.config);
  if (!appConfig) {
    return {};
  }
  return {
    httpRoutes: [
      {
        auth: "gateway",
        handler: async ({ reply }: { request: PluginHttpRequest; reply: PluginHttpReply }) => {
          const notice = await readSwapNotice({ modelRegistry: modelRegistryForConfig(appConfig) });
          return reply.code(200).send({ notice });
        },
        key: classSwitchSwapNoticeRuntimePluginKey,
        method: "GET",
        path: gatewaySwapNoticeControlPath,
        priority: "pre"
      }
    ]
  };
}

const externalNoticeReadTimeoutMs = 1200;

function validNoticePayload(payload: unknown): SwapNotice | null | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const notice = payload.notice;
  if (notice === null) {
    return null;
  }
  return isSwapNotice(notice) ? notice : undefined;
}

async function readResponseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

// The managing process's channel read: fetch the executing runtime's record
// through the authenticated route and mirror it into the local projection, so
// every surface in this process agrees with the runtime that executed the
// swap. A null external record clears the projection; an unusable channel
// falls back to the local projection untouched.
export async function readExternalRuntimeSwapNotice(input: {
  apiKey?: string;
  endpoint: string;
}): Promise<SwapNotice | null> {
  const key = input.apiKey?.trim();
  const localFallback = await readSwapNotice();
  if (!key) {
    return localFallback;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), externalNoticeReadTimeoutMs);
  try {
    const response = await fetch(new URL(gatewaySwapNoticeControlPath, input.endpoint).toString(), {
      headers: { authorization: `Bearer ${key}` },
      signal: controller.signal
    });
    if (response.status !== 200) {
      return localFallback;
    }
    const notice = validNoticePayload(await readResponseJson(response));
    if (notice === undefined) {
      return localFallback;
    }
    if (notice) {
      recordSwapNotice(notice);
    } else {
      clearSwapNotice();
    }
    return notice;
  } catch {
    return localFallback;
  } finally {
    clearTimeout(timeout);
  }
}

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgentAnalysisSessionRow, AgentAnalysisTraceRun, GatewayProviderConfig, RequestLogEntry, RequestLogPage, RequestRouteTrace } from "@ccr/core/contracts/app.ts";
import { AgentAnalysisView } from "@ccr/ui/pages/home/components/dashboard.tsx";
import { LogExpandedDetails, LogsView } from "@ccr/ui/pages/home/components/network-logs.tsx";
import { AppI18nContext, appCopy } from "@ccr/ui/pages/home/shared/i18n.tsx";
import { networkHeaderRows } from "@ccr/ui/pages/home/shared/network.ts";
import { createEmptyAgentAnalysis } from "@ccr/ui/pages/home/shared/usage.ts";

const emptyLogPage: RequestLogPage = {
  generatedAt: "2026-07-23T00:00:00.000Z",
  items: [],
  options: {
    credentials: [],
    models: [],
    providers: []
  },
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 1
};

const sampleRequestLogEntry: RequestLogEntry = {
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  client: "claude-code",
  costUsd: 0.01,
  createdAt: "2026-07-23T00:00:00.000Z",
  credentialChain: [],
  credentialSaturated: false,
  durationMs: 120,
  id: 1,
  inputTokens: 100,
  isStream: true,
  method: "POST",
  model: "claude-sonnet-4",
  ok: true,
  outputTokens: 50,
  path: "/v1/messages",
  provider: "anthropic",
  reasoningTokens: 0,
  requestBody: { encoding: "utf8", sizeBytes: 2, text: "{}", truncated: false },
  requestHeaders: {},
  requestId: "req-token-copy",
  routeAttemptCount: 1,
  routeHopCount: 1,
  routeTraceTruncated: false,
  retryAttempts: [],
  responseBody: { encoding: "utf8", sizeBytes: 2, text: "{}", truncated: false },
  responseHeaders: {},
  statusCode: 200,
  totalTokens: 150,
  url: "/v1/messages"
};

test("LogsView keeps disabled request logs discoverable with an enable action", () => {
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <LogsView
        enabled={false}
        error=""
        filter={{ page: 1, pageSize: 25, status: "all" }}
        loading={false}
        onEnable={() => undefined}
        page={emptyLogPage}
        refreshLogs={() => undefined}
        updateFilter={() => undefined}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /请求日志已关闭/);
  assert.match(html, /启用请求日志/);
});

test("LogsView explains filtered empty results and translates page sizes", () => {
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.en}>
      <LogsView
        error=""
        filter={{ page: 1, pageSize: 25, query: "missing", status: "all" }}
        loading={false}
        page={emptyLogPage}
        refreshLogs={() => undefined}
        updateFilter={() => undefined}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /No request logs match the current filters\./);
  assert.match(html, /Clear filters/);
  assert.match(html, /25 \/ page/);
  assert.doesNotMatch(html, /\/ 页/);
});

test("LogsView keeps Chinese token column copy as Token", () => {
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <LogsView
        error=""
        filter={{ page: 1, pageSize: 25, status: "all" }}
        loading={false}
        page={{ ...emptyLogPage, items: [sampleRequestLogEntry], total: 1 }}
        refreshLogs={() => undefined}
        updateFilter={() => undefined}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /Token/);
  assert.doesNotMatch(html, /令牌/);
});

test("AgentAnalysisView keeps session headings horizontal and shows cache rate and cost", () => {
  const session: AgentAnalysisSessionRow = {
    agent: "claude-code",
    avgDurationMs: 420,
    cacheRatio: 0.375,
    cacheReadTokens: 300,
    cacheTokens: 300,
    cacheWriteTokens: 100,
    client: "claude-code",
    costUsd: 1.25,
    durationMs: 900,
    errorCount: 0,
    id: "session-cache-cost",
    inputTokens: 500,
    lastSeenAt: "2026-07-23T00:01:00.000Z",
    maxConcurrentRequests: 1,
    maxDurationMs: 500,
    models: ["claude-sonnet-4"],
    outputTokens: 100,
    p50DurationMs: 420,
    p95DurationMs: 500,
    p99DurationMs: 500,
    providers: ["anthropic"],
    requestCount: 2,
    sessionCount: 1,
    startedAt: "2026-07-23T00:00:00.000Z",
    subagentCallCount: 1,
    successRate: 1,
    toolCallCount: 1,
    topTools: [{ count: 1, name: "Read" }],
    totalTokens: 1000
  };
  const snapshot = {
    ...createEmptyAgentAnalysis("24h"),
    scannedRequestCount: 2,
    selectedSession: {
      conversation: [{
        agent: session.agent,
        assistant: {
          content: "I inspected the repo and found the README.",
          sourcePreview: false,
          sourceTruncated: false,
          truncated: false
        },
        createdAt: session.startedAt,
        durationMs: 420,
        id: 42,
        model: "claude-sonnet-4",
        provider: "anthropic",
        requestId: "request-with-cost",
        sessionId: session.id,
        statusCode: 200,
        user: {
          content: "inspect repo",
          sourcePreview: false,
          sourceTruncated: false,
          truncated: false
        }
      }],
      endpoints: [],
      errors: [],
      models: [],
      requests: [{
        agent: session.agent,
        cacheReadTokens: 300,
        cacheWriteTokens: 100,
        client: session.client,
        concurrentRequests: 1,
        costUsd: 0.25,
        createdAt: session.startedAt,
        durationMs: 420,
        id: 42,
        inputTokens: 500,
        method: "POST",
        model: "claude-sonnet-4",
        ok: true,
        outputTokens: 100,
        path: "/v1/messages",
        provider: "anthropic",
        requestId: "request-with-cost",
        routeReason: "default",
        sessionId: session.id,
        statusCode: 200,
        toolCallCount: 1,
        tools: ["Read"],
        totalTokens: 1000
      }],
      routes: [],
      session,
      statusCodes: [],
      subagents: [],
      tools: [],
      totals: session,
      trace: {
        agent: session.agent,
        durationMs: session.durationMs,
        endedAt: session.lastSeenAt,
        errorCount: 1,
        id: `${session.agent}:${session.id}`,
        llmRunCount: 1,
        maxDepth: 3,
        rootRunId: `agent:${session.agent}:${session.id}`,
        runCount: 4,
        runs: [
          {
            agent: session.agent,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            concurrentRequests: 1,
            depth: 1,
            durationMs: 80,
            endedAt: session.lastSeenAt,
            id: "tool:42:Read",
            inputTokens: 0,
            kind: "tool",
            name: "Read repository file",
            offsetMs: 120,
            outputTokens: 0,
            parentId: "llm:42",
            requestId: "request-with-cost",
            requestLogId: 42,
            sessionId: session.id,
            startedAt: session.startedAt,
            status: "success",
            statusCode: 200,
            tool: {
              callId: "call-read",
              input: {
                kind: "json",
                preview: "{\"path\":\"README.md\"}",
                sizeBytes: 20,
                truncated: false
              },
              result: {
                kind: "json",
                preview: "{\"ok\":true,\"files\":[\"README.md\"]}",
                sizeBytes: 33,
                truncated: false
              },
              resultRequestLogId: 42
            },
            toolName: "Read",
            totalTokens: 0
          },
          {
            agent: session.agent,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            concurrentRequests: 1,
            depth: 2,
            durationMs: 340,
            endedAt: session.lastSeenAt,
            id: "llm:42",
            inputTokens: 500,
            kind: "llm",
            model: "claude-sonnet-4",
            name: "Model run: claude-sonnet-4",
            offsetMs: 80,
            outputTokens: 100,
            parentId: "subagent:42",
            provider: "anthropic",
            requestId: "request-with-cost",
            requestLogId: 42,
            sessionId: session.id,
            startedAt: session.startedAt,
            status: "success",
            statusCode: 200,
            totalTokens: 1000
          },
          {
            agent: session.agent,
            cacheReadTokens: 300,
            cacheWriteTokens: 100,
            concurrentRequests: 1,
            costUsd: 0.25,
            depth: 1,
            durationMs: 420,
            endedAt: session.lastSeenAt,
            id: "subagent:42",
            inputTokens: 500,
            kind: "subagent",
            model: "claude-sonnet-4",
            name: "Subagent: repo-inspector",
            offsetMs: 0,
            outputTokens: 100,
            parentId: `agent:${session.agent}:${session.id}`,
            provider: "anthropic",
            requestId: "request-with-cost",
            requestLogId: 42,
            sessionId: session.id,
            startedAt: session.startedAt,
            status: "success",
            statusCode: 200,
            totalTokens: 1000
          },
          {
            agent: session.agent,
            cacheReadTokens: session.cacheReadTokens,
            cacheWriteTokens: session.cacheWriteTokens,
            concurrentRequests: session.maxConcurrentRequests,
            costUsd: 0.75,
            depth: 0,
            durationMs: session.durationMs,
            endedAt: session.lastSeenAt,
            id: `agent:${session.agent}:${session.id}`,
            inputTokens: session.inputTokens,
            kind: "agent",
            name: "Claude Code session",
            offsetMs: 0,
            outputTokens: session.outputTokens,
            sessionId: session.id,
            startedAt: session.startedAt,
            status: "partial",
            totalTokens: session.totalTokens
          }
        ] satisfies AgentAnalysisTraceRun[],
        sessionId: session.id,
        startedAt: session.startedAt,
        subagentRunCount: 1,
        toolRunCount: 1
      }
    },
    sessions: [session]
  };

  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <AgentAnalysisView
        agentFilter="all"
        error=""
        loading={false}
        range="24h"
        refreshAnalysis={() => undefined}
        setAgentFilter={() => undefined}
        setRange={() => undefined}
        setSelectedSession={() => undefined}
        snapshot={snapshot}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /持续时间/);
  assert.match(html, /子代理/);
  assert.match(html, /缓存率/);
  assert.match(html, /37\.50%/);
  assert.match(html, /成本/);
  assert.match(html, /会话记录/);
  assert.match(html, /调用链路/);
  assert.match(html, /会话轨迹/);
  assert.ok(html.indexOf("调用链路") >= 0);
  assert.ok(html.indexOf("调用链路") < html.indexOf("会话轨迹"));
  assert.ok(html.indexOf("会话轨迹") < html.indexOf("会话记录"));
  assert.ok(html.indexOf("Claude Code session") < html.indexOf("Subagent: repo-inspector"));
  assert.ok(html.indexOf("Subagent: repo-inspector") < html.indexOf("Model run: claude-sonnet-4"));
  assert.ok(html.indexOf("Model run: claude-sonnet-4") < html.indexOf("Read repository file"));
  assert.match(html, /部分失败/);
  assert.match(html, /Token/);
  assert.doesNotMatch(html, /令牌/);
  assert.match(html, /\$1\.25/);
  assert.match(html, /\$0\.75/);
  assert.doesNotMatch(html, /会话详情仅展示最新的/);
  assert.doesNotMatch(html, /1 \/ 2 条请求/);
  assert.match(html, /border-amber-200/);
  assert.match(html, /min-w-\[64px\]/);
  assert.match(html, /whitespace-nowrap/);
});

test("AgentAnalysisView surfaces bounded analysis and missing session states", () => {
  const snapshot = {
    ...createEmptyAgentAnalysis("30d"),
    requestScanLimit: 5000,
    requestScanTruncated: true,
    scannedRequestCount: 5000
  };

  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <AgentAnalysisView
        agentFilter="all"
        error=""
        loading={false}
        range="30d"
        refreshAnalysis={() => undefined}
        selectedSession={{ agent: "codex", id: "missing-session" }}
        setAgentFilter={() => undefined}
        setRange={() => undefined}
        setSelectedSession={() => undefined}
        snapshot={snapshot}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /分析结果仅包含最新的/);
  assert.match(html, /5,000/);
  assert.match(html, /未找到该会话，或它不在当前时间范围内/);
  assert.doesNotMatch(html, /正在加载会话指标/);
});

test("#1801 LogsView shows missing HTTP status as neutral", () => {
  const entry = { ...sampleRequestLogEntry, ok: false, statusCode: 0 };
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.en}>
      <LogsView error="" filter={{ page: 1, pageSize: 25, status: "all" }} loading={false}
        page={{ ...emptyLogPage, items: [entry], total: 1 }} refreshLogs={() => undefined} updateFilter={() => undefined} />
    </AppI18nContext.Provider>
  );
  assert.match(html, /network-dot-unknown/);
  assert.doesNotMatch(html, /network-dot-error|network-state-pill-error/);
});

// Step-down fixtures reuse every existing RequestLogEntry field — no schema
// change and no mock of React rendering. The routeTrace contains a decision hop
// whose reason the expanded detail block should surface.
const stepDownRouteTrace: RequestRouteTrace = {
  attemptCount: 2,
  complete: true,
  hopCount: 2,
  hops: [
    {
      changes: [],
      decision: { reason: "no live Opus triple", source: "class-switch" },
      durationMs: 5,
      kind: "decision",
      name: "router.policy",
      phase: "routing",
      seq: 1,
      startedOffsetMs: 0,
      status: "ok"
    },
    {
      attempt: 1,
      changes: [],
      durationMs: 115,
      kind: "attempt",
      name: "upstream.attempt.prepare",
      phase: "attempt",
      seq: 2,
      startedOffsetMs: 5,
      status: "ok"
    }
  ],
  truncated: false,
  version: 2
};

const stepDownRequestLogEntry: RequestLogEntry = {
  ...sampleRequestLogEntry,
  credentialId: "cred:sonnet",
  provider: "OpenRouter",
  requestedModel: "claude-opus-4-6",
  resolvedModel: "OpenRouter/claude-sonnet-4",
  responseModel: "claude-opus-4-6",
  responseHeaders: {
    "content-type": "application/json",
    "x-ccr-requested-model": "claude-opus-4-6",
    "x-ccr-served-model": "OpenRouter/claude-sonnet-4"
  },
  routeTrace: stepDownRouteTrace
};

// Controls: same class, higher class (upgrade), non-class models, and an
// incomplete entry with only one derivable model name.
const sameClassLogEntry: RequestLogEntry = {
  ...stepDownRequestLogEntry,
  requestedModel: "claude-opus-4-6",
  resolvedModel: "claude-opus-4-6",
  responseModel: "claude-opus-4-6",
  responseHeaders: {}
};
const higherClassLogEntry: RequestLogEntry = {
  ...stepDownRequestLogEntry,
  requestedModel: "claude-sonnet-4",
  resolvedModel: "claude-opus-4-6",
  responseModel: "claude-sonnet-4"
};
const nonClassLogEntry: RequestLogEntry = {
  ...stepDownRequestLogEntry,
  requestedModel: "glm-5.3-flash",
  resolvedModel: "glm-5.3-flash",
  responseModel: "glm-5.3-flash"
};
const incompleteLogEntry: RequestLogEntry = {
  ...stepDownRequestLogEntry,
  requestedModel: undefined,
  resolvedModel: undefined,
  responseModel: "claude-sonnet-4"
};

function logsViewMarkup(items: RequestLogEntry[], providers?: GatewayProviderConfig[]): string {
  return renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.en}>
      <LogsView
        error=""
        filter={{ page: 1, pageSize: 25, status: "all" }}
        loading={false}
        page={{ ...emptyLogPage, items, total: items.length }}
        providers={providers}
        refreshLogs={() => undefined}
        updateFilter={() => undefined}
      />
    </AppI18nContext.Provider>
  );
}

function expandedDetailsMarkup(entry: RequestLogEntry, language: "en" | "zh" = "en", providers?: GatewayProviderConfig[]): string {
  return renderToStaticMarkup(
    <AppI18nContext.Provider value={language === "zh" ? appCopy.zh : appCopy.en}>
      <LogExpandedDetails entry={entry} providers={providers} />
    </AppI18nContext.Provider>
  );
}

const stepDownPillPattern = /network-service-paused[^"]*shrink-0[^"]*whitespace-nowrap[^"]*rounded px-1\.5 py-0\.5 text-\[10px\] font-bold/;

test("step-down log entries show SD pills and expanded details", () => {
  const listHtml = logsViewMarkup([stepDownRequestLogEntry]);

  // One fixed-face SD pill per affected row variant (desktop row + mobile card).
  assert.equal((listHtml.match(/>SD</g) ?? []).length, 2);
  assert.equal((listHtml.match(/title="Step-down: requested Opus, served Sonnet"/g) ?? []).length, 2);
  assert.match(listHtml, stepDownPillPattern);
  // The pill is noninteractive and never carries a click affordance.
  assert.doesNotMatch(listHtml, /<button[^>]*>[^<]*SD</);
  // This entry has no retries, so only the SD pill appears (no R pill).
  assert.doesNotMatch(listHtml, />R\d+</);

  const expandedHtml = expandedDetailsMarkup(stepDownRequestLogEntry);

  // Exactly one warning block, above the existing metric grid.
  assert.equal((expandedHtml.match(/network-body-warning/g) ?? []).length, 1);
  assert.ok(expandedHtml.indexOf("network-body-warning") < expandedHtml.indexOf("network-body-meta"));
  assert.match(expandedHtml, /Step-down notice/);
  // Available LogMetric pairs with capitalized classes and mono values.
  assert.match(expandedHtml, /Requested class/);
  assert.match(expandedHtml, /Served class/);
  assert.match(expandedHtml, />Opus</);
  assert.match(expandedHtml, />Sonnet</);
  assert.match(expandedHtml, /font-mono[^>]*>claude-sonnet-4</);
  assert.match(expandedHtml, /font-mono[^>]*>cred:sonnet</);
  assert.match(expandedHtml, /no live Opus triple/);
  // Non-Anthropic served provider shows the same safeguards sentence.
  assert.match(expandedHtml, /Auto mode will not receive Anthropic safeguards from this non-Anthropic provider\./);
  // No placeholder dashes for missing values.
  assert.doesNotMatch(expandedHtml, />-</);
});

test("SD pills only mark strict lower-class step-down rows", () => {
  const html = logsViewMarkup([
    sameClassLogEntry,
    higherClassLogEntry,
    nonClassLogEntry,
    incompleteLogEntry
  ]);

  // Zero affected rows → no pills anywhere.
  assert.ok(!html.includes(">SD<"));
  assert.ok(!html.includes("Step-down notice"));
  assert.doesNotMatch(html, stepDownPillPattern);

  // Two affected rows render exactly two pills per variant (4 total).
  const twoRowsHtml = logsViewMarkup([stepDownRequestLogEntry, { ...stepDownRequestLogEntry, id: 2 }]);
  assert.equal((twoRowsHtml.match(/>SD</g) ?? []).length, 4);
});

// The safeguards sentence follows the provider's own Anthropic identity (the
// shared core predicate), never the display name: an "AnthropicShim" display
// name with provider "anthropic" is Anthropic, while a borrowed
// anthropic_messages protocol on a non-Anthropic provider is not.
const providerFixtures: GatewayProviderConfig[] = [
  { models: ["claude-sonnet-4"], name: "OpenRouter" },
  { models: ["sonnet-live"], name: "AnthropicShim", provider: "anthropic" },
  { models: ["sonnet-live"], name: "BorrowedAnthropic", provider: "openai", type: "anthropic_messages" },
  { models: ["sonnet-live"], name: "ExplicitType", type: "anthropic" }
];

// A production-shaped trace keeps the late fallback.execution-plan decision
// hop after the class-switch decision; the step-down Reason must select the
// marked class-switch decision only, never the generic fallback mode text.
const productionShapedRouteTrace: RequestRouteTrace = {
  attemptCount: 2,
  complete: true,
  hopCount: 3,
  hops: [
    {
      changes: [],
      decision: { reason: "no live Opus triple", source: "class-switch" },
      durationMs: 5,
      kind: "decision",
      name: "router.policy",
      phase: "routing",
      seq: 1,
      startedOffsetMs: 0,
      status: "ok"
    },
    {
      attempt: 1,
      changes: [],
      durationMs: 115,
      kind: "attempt",
      name: "upstream.attempt.prepare",
      phase: "attempt",
      seq: 2,
      startedOffsetMs: 5,
      status: "ok"
    },
    {
      changes: [],
      decision: { reason: "fallback:model-chain", source: "execution-plan" },
      durationMs: 2,
      kind: "decision",
      name: "fallback.execution-plan",
      phase: "planning",
      seq: 3,
      startedOffsetMs: 8,
      status: "ok"
    }
  ],
  truncated: false,
  version: 2
};

test("expanded Reason uses the class-switch decision, not the fallback hop", () => {
  const html = expandedDetailsMarkup({ ...stepDownRequestLogEntry, routeTrace: productionShapedRouteTrace });
  assert.match(html, /no live Opus triple/);
  assert.doesNotMatch(html, /fallback:model-chain/);

  // No class-switch decision → Reason is omitted, never replaced by an
  // arbitrary last hop reason.
  const unmarkedTrace: RequestRouteTrace = {
    ...productionShapedRouteTrace,
    hops: productionShapedRouteTrace.hops.filter((hop) => hop.decision?.source !== "class-switch")
  };
  const unmarkedHtml = expandedDetailsMarkup({ ...stepDownRequestLogEntry, routeTrace: unmarkedTrace });
  assert.doesNotMatch(unmarkedHtml, /Reason/);
  assert.doesNotMatch(unmarkedHtml, /fallback:model-chain/);
});

test("safeguards follow the configured provider identity, not the display name", () => {
  const shimEntry = { ...stepDownRequestLogEntry, provider: "AnthropicShim" };
  const shimHtml = expandedDetailsMarkup(shimEntry, "en", providerFixtures);
  assert.doesNotMatch(shimHtml, /safeguards from this non-Anthropic provider/);

  // The explicit-type fallback counts as Anthropic only when the `provider`
  // field is absent.
  const explicitTypeHtml = expandedDetailsMarkup(
    { ...stepDownRequestLogEntry, provider: "ExplicitType" },
    "en",
    providerFixtures
  );
  assert.doesNotMatch(explicitTypeHtml, /safeguards from this non-Anthropic provider/);

  // A borrowed anthropic_messages protocol on a non-Anthropic provider keeps
  // the sentence.
  const borrowedHtml = expandedDetailsMarkup(
    { ...stepDownRequestLogEntry, provider: "BorrowedAnthropic" },
    "en",
    providerFixtures
  );
  assert.match(borrowedHtml, /Auto mode will not receive Anthropic safeguards from this non-Anthropic provider\./);

  // An unresolved display name stays conservative and shows the sentence.
  const unresolvedHtml = expandedDetailsMarkup({ ...stepDownRequestLogEntry, provider: "GhostProvider" }, "en", providerFixtures);
  assert.match(unresolvedHtml, /Auto mode will not receive Anthropic safeguards from this non-Anthropic provider\./);
});

test("encoded Claude App route ids render the same SD surfaces", () => {
  const hex = Buffer.from("claude-opus-4-6", "utf8").toString("hex");
  const encodedEntries: RequestLogEntry[] = [
    { ...stepDownRequestLogEntry, requestedModel: `anthropic/claude-ccr-h${hex}` },
    { ...stepDownRequestLogEntry, requestedModel: `anthropic/claude-ccr7-h${hex}` },
    { ...stepDownRequestLogEntry, requestedModel: `anthropic/claude-ccr-h${hex}[1m]` }
  ];

  const listHtml = logsViewMarkup(encodedEntries);
  // Three affected rows × two row variants (desktop row + mobile card).
  assert.equal((listHtml.match(/>SD</g) ?? []).length, 6);
  assert.equal((listHtml.match(/title="Step-down: requested Opus, served Sonnet"/g) ?? []).length, 6);

  const expandedHtml = expandedDetailsMarkup(encodedEntries[0]);
  assert.match(expandedHtml, /Step-down notice/);
  assert.match(expandedHtml, />Opus</);
  assert.match(expandedHtml, />Sonnet</);
  assert.match(expandedHtml, /no live Opus triple/);
});

test("ordinary model-chain fallbacks without paired headers render no SD surfaces", () => {
  // The parent's model-chain can route an Opus class name to a Sonnet model
  // without the class-switch planner. Core emits the paired disclosure
  // headers only for an actual recorded swap, so their absence suppresses
  // both the pill and the detail block even though both class names derive.
  const modelChainEntry: RequestLogEntry = {
    ...stepDownRequestLogEntry,
    responseHeaders: {
      "content-type": "application/json"
    }
  };
  const listHtml = logsViewMarkup([modelChainEntry]);
  assert.ok(!listHtml.includes(">SD<"));
  const html = expandedDetailsMarkup(modelChainEntry);
  assert.ok(!html.includes("Step-down notice"));

  // Contradictory evidence — headers present but the served model not a
  // lower class — renders nothing too.
  const contradictoryEntry: RequestLogEntry = {
    ...modelChainEntry,
    resolvedModel: "claude-opus-4-6",
    responseModel: "claude-opus-4-6"
  };
  assert.ok(!expandedDetailsMarkup(contradictoryEntry).includes("Step-down notice"));
});

test("SD pill face stays fixed while long model ids live in the title tooltip", () => {
  const longIdEntry: RequestLogEntry = {
    ...stepDownRequestLogEntry,
    resolvedModel: "OpenRouter/anthropic/claude-sonnet-4-20260514-with-very-long-route-suffix"
  };
  const html = logsViewMarkup([longIdEntry]);

  const pillTitles = html.match(/title="Step-down[^"]*"/g) ?? [];
  assert.ok(pillTitles.length >= 2);
  for (const title of pillTitles) {
    // The tooltip carries class names only — never a model id.
    assert.ok(title === 'title="Step-down: requested Opus, served Sonnet"', title);
  }
  // The pill face is exactly the two letters SD.
  assert.match(html, /network-service-paused[^"]*"[^>]*>SD</);
});

test("expanded step-down details render available pairs and omit missing ones", () => {
  // Missing routeTrace omits only the Reason pair.
  const noReasonHtml = expandedDetailsMarkup({ ...stepDownRequestLogEntry, routeTrace: undefined });
  assert.match(noReasonHtml, /Step-down notice/);
  assert.doesNotMatch(noReasonHtml, /Reason/);
  // The reason text is gone entirely — never rendered as a dash substitute.
  assert.doesNotMatch(noReasonHtml, /no live Opus triple/);

  // Missing credential omits only the Token pair.
  const noCredentialHtml = expandedDetailsMarkup({ ...stepDownRequestLogEntry, credentialId: undefined });
  assert.match(noCredentialHtml, /Step-down notice/);
  assert.doesNotMatch(noCredentialHtml, /Token/);
  assert.match(noCredentialHtml, /font-mono[^>]*>claude-sonnet-4</);

  // Anthropic served provider hides the safeguards sentence — resolved from
  // the configured provider identity, not the display-name text alone.
  const anthropicHtml = expandedDetailsMarkup(
    { ...stepDownRequestLogEntry, provider: "anthropic" },
    "en",
    [{ models: ["claude-sonnet-4"], name: "anthropic", provider: "anthropic" }]
  );
  assert.doesNotMatch(anthropicHtml, /safeguards from this non-Anthropic provider/);

  // Same-class and incomplete entries render no step-down block at all.
  for (const entry of [sameClassLogEntry, incompleteLogEntry]) {
    const html = expandedDetailsMarkup(entry);
    assert.ok(!html.includes("Step-down notice"), entry.requestId);
    assert.equal((html.match(/network-body-warning/g) ?? []).length, 0);
  }

  // Exactly one detail block per expanded entry, even when both header fields agree.
  const onceHtml = expandedDetailsMarkup(stepDownRequestLogEntry);
  assert.equal((onceHtml.match(/Step-down notice/g) ?? []).length, 1);
});

test("response header rows expose the paired step-down headers as ordinary rows", () => {
  // LogJsonPanel renders its header tab from networkHeaderRows(entry.responseHeaders)
  // with no header-table code change in this phase; assert the exact row contract
  // that table displays, including the copyable text values and absence behavior.
  // Header names are title-cased by the existing formatHeaderName display rule,
  // exactly like every other header row in the table.
  const rows = networkHeaderRows(stepDownRequestLogEntry.responseHeaders);
  const requestedRows = rows.filter(([key]) => key === "X-Ccr-Requested-Model");
  const servedRows = rows.filter(([key]) => key === "X-Ccr-Served-Model");

  assert.equal(requestedRows.length, 1);
  assert.equal(servedRows.length, 1);
  assert.deepEqual(requestedRows[0], ["X-Ccr-Requested-Model", "claude-opus-4-6"]);
  assert.deepEqual(servedRows[0], ["X-Ccr-Served-Model", "OpenRouter/claude-sonnet-4"]);

  // Headers absent from a response → no header rows at all.
  assert.deepEqual(networkHeaderRows({}), []);

  // The paired headers appear as ordinary rows in the same row shape as other
  // header values (name + raw value, wrapped by the existing value-cell geometry).
  for (const [key, value] of rows) {
    assert.equal(typeof key, "string");
    assert.equal(typeof value, "string");
  }
});

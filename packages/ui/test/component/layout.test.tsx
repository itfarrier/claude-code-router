import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SwapNotice } from "@ccr/core/contracts/app.ts";
import { GatewayStartupErrorBanner, groupSidebarNavigation, MainLayout, SwapNoticeBanner, UpdateEntryButton } from "@ccr/ui/pages/home/components/layout.tsx";
import { MediaModelConfigurationPanel, VirtualModelsView } from "@ccr/ui/pages/home/components/virtual-models.tsx";
import { AppI18nContext, appCopy } from "@ccr/ui/pages/home/shared/i18n.tsx";
import { createVirtualModelDraft } from "@ccr/ui/pages/home/shared/virtual-models.ts";
import { appConfigFixture } from "../fixtures/index.ts";
import { fallbackGatewayStatus, fallbackUpdateStatus } from "@ccr/ui/pages/home/shared/fallbacks.ts";
import { navigation } from "@ccr/ui/pages/home/shared/options.ts";
import { formatUpdateReleaseNotes, shouldCheckForUpdateOnOpen, UpdateDialog } from "@ccr/ui/pages/home/components/update.tsx";

test("sidebar navigation groups pages and hides networking from the sidebar", () => {
  const groups = groupSidebarNavigation(navigation);

  assert.deepEqual(groups.map((group) => group.label), ["Workspace", "Setup", "Monitor", "Advanced"]);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.id)), [
    ["overview"],
    ["providers", "profile", "routing"],
    ["logs", "observability"],
    ["virtual-models", "models", "api-keys", "extensions"]
  ]);
  assert.equal(groups.some((group) => group.items.some((item) => item.id === "networking")), false);

  const filteredGroups = groupSidebarNavigation(navigation.filter((item) => item.id !== "observability"));
  assert.deepEqual(filteredGroups.map((group) => group.items.map((item) => item.id)), [
    ["overview"],
    ["providers", "profile", "routing"],
    ["logs"],
    ["virtual-models", "models", "api-keys", "extensions"]
  ]);
});

test("sidebar navigation scrolls vertically without displacing the settings footer", () => {
  const html = renderToStaticMarkup(
    <MainLayout
      activeView="networking"
      agentAnalysisEnabled={false}
      compactLayout={false}
      config={appConfigFixture()}
      copy={appCopy.en}
      gatewayActionBusy={false}
      gatewayEndpoint="http://127.0.0.1:3456"
      gatewayStatus={fallbackGatewayStatus}
      isMac={false}
      needsTrafficLightSafeArea={false}
      networkCaptureEnabled={false}
      onOpenServerSettings={() => undefined}
      onOpenSettings={() => undefined}
      onOpenUpdate={() => undefined}
      onSelectNavigationItem={() => undefined}
      onToggleSidebar={() => undefined}
      requestLogsEnabled={false}
      shouldReduceMotion={true}
      sidebarOpen
      toggleGatewayService={() => undefined}
      updateActionBusy={false}
      updateStatus={fallbackUpdateStatus}
      viewProps={{} as never}
      visibleNavigation={navigation}
    />
  );

  assert.match(html, /<nav class="[^"]*overflow-y-auto[^"]*max-\[720px\]:overflow-y-hidden[^"]*"/);
  assert.match(html, /class="grid shrink-0 gap-1 border-t/);
  assert.ok(html.indexOf("</nav>") < html.indexOf("Settings"));
});

test("GatewayStartupErrorBanner renders startup failure details", () => {
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <GatewayStartupErrorBanner message="没有可用模型。请先配置供应商。" onOpenServerSettings={() => undefined} />
    </AppI18nContext.Provider>
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /服务启动失败/);
  assert.match(html, /没有可用模型。请先配置供应商。/);
  assert.match(html, />服务<\/button>/);
});

test("GatewayStartupErrorBanner stays hidden without a failure message", () => {
  const html = renderToStaticMarkup(<GatewayStartupErrorBanner message="" />);

  assert.equal(html, "");
});

// Fixed swap fixture shared by the swap-banner tests. The notice contract
// carries operator-display scalars only, so a raw credential secret and an
// upstream message marker are declared here as negative controls that must
// never appear in rendered notice markup.
const swapNoticeSecret = "sk-ant-api03-RAW-CREDENTIAL-SECRET-DO-NOT-RENDER";
const swapNoticeMessageMarker = "upstream-error-message-marker-DO-NOT-RENDER";

const swapNoticeFixture: SwapNotice = {
  credentialLabel: "cred:sonnet",
  model: "sonnet-live",
  provider: "OpenRouter",
  reason: "no live Opus triple",
  requestedClass: "opus",
  safeguardsApplies: false,
  servedClass: "sonnet",
  sinceAt: "2026-07-23T15:02:00.000Z"
};

// The banner formats sinceAt as a local 24-hour HH:mm; computing the expected
// label with the same contract keeps the assertion timezone-independent while
// still pinning the hour/minute format (12-hour or date rendering would fail).
function swapSinceLabel(): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit"
  }).format(new Date(swapNoticeFixture.sinceAt));
}

function swapBannerMarkup(notice: SwapNotice | null, language: "en" | "zh" = "en"): string {
  return renderToStaticMarkup(
    <AppI18nContext.Provider value={language === "zh" ? appCopy.zh : appCopy.en}>
      <SwapNoticeBanner notice={notice} />
    </AppI18nContext.Provider>
  );
}

test("SwapNoticeBanner renders the current swap as a polite three-row status", () => {
  const html = swapBannerMarkup(swapNoticeFixture);

  // Polite informational status, never an assertive alert or dismissible dialog.
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /role="alert"|aria-live="assertive"/);
  // Token-based warning surface and the downward class-move icon.
  assert.match(html, /network-body-warning/);
  assert.match(html, /lucide-arrow-down/);
  assert.doesNotMatch(html, /lucide-circle-alert/);
  // Row 1: capitalized classes and 24-hour HH:mm since label.
  const since = swapSinceLabel();
  assert.match(html, new RegExp(`Opus is replaced by Sonnet since ${since}`));
  // Row 2: model, provider, credential label, and reason in one detail line,
  // with the model id and credential label rendered as mono spans.
  assert.match(
    html,
    /Serving <span [^>]*title="sonnet-live"[^>]*>sonnet-live<\/span> on OpenRouter · token <span [^>]*title="cred:sonnet"[^>]*>cred:sonnet<\/span> · no live Opus triple/
  );
  // Row 3: safeguards sentence for the non-Anthropic served provider.
  assert.match(html, /Auto mode will not receive Anthropic safeguards from this non-Anthropic provider\./);
  // Three content rows render in title → detail → safeguards order.
  const titleIndex = html.indexOf("Opus is replaced by Sonnet since");
  const detailIndex = html.indexOf("Serving <span");
  const safeguardsIndex = html.indexOf("Auto mode will not receive Anthropic safeguards");
  assert.ok(titleIndex >= 0 && detailIndex > titleIndex && safeguardsIndex > detailIndex);
  // Model id and credential label render mono with title tooltips.
  assert.ok((html.match(/font-mono/g) ?? []).length >= 2);
  assert.match(html, /title="sonnet-live"/);
  assert.match(html, /title="cred:sonnet"/);
  // Detail rows wrap inside the banner geometry instead of clipping.
  assert.match(html, /break-words/);
  // No action control, destructive alert styling, or light-only Badge warning.
  assert.doesNotMatch(html, /<button|role="button"/);
  assert.doesNotMatch(html, /destructive/);
  assert.doesNotMatch(html, /border-amber-200|bg-amber-50|text-amber-700/);
  // No raw secret or upstream message marker ever enters the notice markup.
  assert.ok(!html.includes(swapNoticeSecret));
  assert.ok(!html.includes(swapNoticeMessageMarker));
});

test("SwapNoticeBanner renders nothing without a notice", () => {
  assert.equal(swapBannerMarkup(null), "");
  assert.equal(swapBannerMarkup(undefined), "");
});

test("SwapNoticeBanner keeps long ids mono with tooltips and wraps the detail", () => {
  const longModel = "OpenRouter/deepseek/deepseek-chat-v3.1-free-2026-preview-with-long-suffix";
  const longCredential = "cred:sonnet-fallback-key-with-a-long-suffix-label";
  const html = swapBannerMarkup({
    ...swapNoticeFixture,
    credentialLabel: longCredential,
    model: longModel
  });

  assert.ok((html.match(/font-mono/g) ?? []).length >= 2);
  assert.ok(html.includes(`title="${longModel}"`));
  assert.ok(html.includes(`title="${longCredential}"`));
  assert.match(html, /break-words/);
  assert.match(html, /network-body-warning/);
  assert.ok(!html.includes(swapNoticeSecret));
});

test("SwapNoticeBanner renders Chinese copy for the swap notice", () => {
  const since = swapSinceLabel();
  const html = swapBannerMarkup(swapNoticeFixture, "zh");

  assert.match(html, new RegExp(`自 ${since} 起，Opus 由 Sonnet 代答`));
  assert.match(
    html,
    /服务模型 <span [^>]*title="sonnet-live"[^>]*>sonnet-live<\/span>（OpenRouter）· 令牌 <span [^>]*title="cred:sonnet"[^>]*>cred:sonnet<\/span> · no live Opus triple/
  );
  assert.match(html, /非 Anthropic 供应商不提供 Anthropic safeguards，auto 模式将不会收到该字段。/);
  assert.match(html, /role="status"/);
  assert.match(html, /network-body-warning/);
});

test("SwapNoticeBanner omits the safeguards line when the served provider is Anthropic", () => {
  const html = swapBannerMarkup({ ...swapNoticeFixture, safeguardsApplies: true });

  assert.doesNotMatch(html, /safeguards from this non-Anthropic provider/);
  assert.match(html, /Opus is replaced by Sonnet since/);
  assert.match(html, /Serving <span [^>]*title="sonnet-live"[^>]*>sonnet-live<\/span> on OpenRouter/);
});

function mainLayoutMarkup(swapNotice: SwapNotice | null): string {
  return renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.en}>
      <MainLayout
        activeView="networking"
        agentAnalysisEnabled={false}
        compactLayout={false}
        config={appConfigFixture()}
        copy={appCopy.en}
        gatewayActionBusy={false}
        gatewayEndpoint="http://127.0.0.1:3456"
        gatewayStartupError="Gateway failed to start."
        gatewayStatus={fallbackGatewayStatus}
        isMac={false}
        needsTrafficLightSafeArea={false}
        networkCaptureEnabled={false}
        onOpenServerSettings={() => undefined}
        onOpenSettings={() => undefined}
        onOpenUpdate={() => undefined}
        onSelectNavigationItem={() => undefined}
        onToggleSidebar={() => undefined}
        requestLogsEnabled={false}
        shouldReduceMotion={true}
        sidebarOpen
        swapNotice={swapNotice}
        toggleGatewayService={() => undefined}
        updateActionBusy={false}
        updateStatus={fallbackUpdateStatus}
        viewProps={{} as never}
        visibleNavigation={navigation}
      />
    </AppI18nContext.Provider>
  );
}

test("MainLayout mounts the swap banner below the startup error banner", () => {
  const html = mainLayoutMarkup(swapNoticeFixture);

  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Opus is replaced by Sonnet since/);
  // Mount geometry matches the error banner rhythm (20px sides, 12px top).
  assert.match(html, /network-body-warning[^"]*mx-5 mt-3 max-\[720px\]:mx-3/);
  // The swap banner mounts directly below the startup error banner.
  const errorIndex = html.indexOf("Service failed to start");
  const swapIndex = html.indexOf("Opus is replaced by Sonnet since");
  assert.ok(errorIndex >= 0 && swapIndex > errorIndex);

  // Without a notice no banner mounts at all.
  const emptyHtml = mainLayoutMarkup(null);
  assert.doesNotMatch(emptyHtml, /role="status"/);
  assert.ok(!emptyHtml.includes("Opus is replaced by Sonnet"));
});

test("Fusion page does not render a standalone Grok media panel", () => {
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <VirtualModelsView
        addVirtualModel={() => undefined}
        editVirtualModel={() => undefined}
        profiles={[]}
        removeVirtualModel={() => undefined}
        setVirtualModelEnabled={() => undefined}
      />
    </AppI18nContext.Provider>
  );

  assert.doesNotMatch(html, /Grok 生图与生视频/);
  assert.doesNotMatch(html, /Fusion 内置工具/);
});

test("media tool configuration renders a generic provider model selector without backend settings", () => {
  const config = appConfigFixture();
  config.Providers = [{
    apikey: "provider-key",
    baseUrl: "https://media.example/v1",
    capabilities: [{ baseUrl: "https://media.example/v1", type: "openai_image_generations" }],
    models: ["image-model"],
    name: "Media Provider"
  }];
  const draft = createVirtualModelDraft(config);
  const html = renderToStaticMarkup(
    <AppI18nContext.Provider value={appCopy.zh}>
      <MediaModelConfigurationPanel
        draft={draft}
        kind="image"
        modelOptions={[{ label: "Media Provider/Image Model", value: "Media Provider/image-model" }]}
        onChange={() => undefined}
      />
    </AppI18nContext.Provider>
  );

  assert.match(html, /图片模型/);
  assert.match(html, /Media Provider\/Image Model/);
  assert.match(html, /ai-gateway/);
  assert.match(html, /Grok Agent/);
  assert.doesNotMatch(html, /Grok CLI（内置）/);
  assert.doesNotMatch(html, /API Key|允许读取图片|产物保留|图片并发|视频并发|执行后端/);
});

test("UpdateEntryButton keeps update-center semantics when an update is available", () => {
  const html = renderToStaticMarkup(
    <UpdateEntryButton
      actionBusy={false}
      copy={appCopy.en}
      onOpen={() => undefined}
      status={{
        ...fallbackUpdateStatus,
        availableVersion: "3.0.15",
        canDownload: true,
        state: "available",
        supported: true
      }}
    />
  );

  assert.match(html, /aria-label="Update available"/);
  assert.match(html, /lucide-refresh-cw/);
  assert.match(html, /data-update-available-indicator/);
  assert.doesNotMatch(html, /lucide-download/);
});

test("UpdateDialog shows a compact action set and sanitized release notes", () => {
  const html = renderToStaticMarkup(
    <UpdateDialog
      actionBusy=""
      actionError=""
      copy={appCopy.en}
      onCheck={async () => undefined}
      onClose={() => undefined}
      onDownload={async () => undefined}
      onInstall={async () => undefined}
      status={{
        ...fallbackUpdateStatus,
        availableVersion: "3.0.17",
        canDownload: true,
        currentVersion: "3.0.13",
        releaseNotes: `3.0.17
<h2>What's Changed</h2>
<ul>
<li>fix(zcode): 保证模型同步正确的上下文长度 by <a class="user-mention" href="https://github.com/jesieleo">@jesieleo</a> in <a href="https://github.com/musistudio/claude-code-router/pull/437">#437</a></li>
</ul>`,
        state: "available",
        supported: true
      }}
    />
  );

  assert.match(html, /Download update/);
  assert.match(html, /fix\(zcode\): 保证模型同步正确的上下文长度/);
  assert.doesNotMatch(html, /Check for updates|Install and restart|Feed URL|Last checked/);
  assert.doesNotMatch(html, /&lt;h2|user-mention|@jesieleo|#437/);
});

test("formatUpdateReleaseNotes converts GitHub release HTML to concise text", () => {
  assert.equal(formatUpdateReleaseNotes(`3.0.17
<h2>What's Changed</h2>
<ul>
<li>feat: add &amp; verify update notes by <a class="user-mention" href="https://github.com/a">@author</a> in <a href="https://github.com/musistudio/claude-code-router/pull/1">#1</a></li>
</ul>
<p>Full Changelog: <a href="https://github.com/musistudio/claude-code-router/compare/v3.0.13...v3.0.17">v3.0.13...v3.0.17</a></p>`), "- feat: add & verify update notes");
});

test("opening the update entry only checks when the status is not already actionable", () => {
  for (const state of ["idle", "not-available", "error"] as const) {
    assert.equal(shouldCheckForUpdateOnOpen({ ...fallbackUpdateStatus, state }), true, state);
  }
  for (const state of ["checking", "available", "downloading", "downloaded", "installing"] as const) {
    assert.equal(shouldCheckForUpdateOnOpen({ ...fallbackUpdateStatus, state }), false, state);
  }
});

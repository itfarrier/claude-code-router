---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# External Integrations

**Analysis Date:** 2026-11-14

## APIs & External Services

CCR is a local gateway. It does not call a CCR-hosted inference API. Upstream model calls go to provider base URLs stored in config, starting from the presets in `packages/core/src/providers/presets/`. The HTTP runtime is `@the-next-ai/ai-gateway`, launched by `packages/core/src/gateway/core-runtime/supervisor.ts`. Preset registration is the array in `packages/core/src/providers/presets/index.ts`.

**Model providers (built-in presets):**

Each preset module exports `baseUrl` values and protocol tags (`openai_chat_completions`, `openai_responses`, `anthropic_messages`, `gemini_generate_content`). Add a new preset as a folder under `packages/core/src/providers/presets/` and append it in `packages/core/src/providers/presets/index.ts`.

| Preset id | Default base URL | Module |
| --- | --- | --- |
| `openai` | `https://api.openai.com/v1` | `packages/core/src/providers/presets/openai/index.ts` |
| `anthropic` | `https://api.anthropic.com` | `packages/core/src/providers/presets/anthropic/index.ts` |
| `gemini` | `https://generativelanguage.googleapis.com` | `packages/core/src/providers/presets/gemini/index.ts` |
| `openrouter` | `https://openrouter.ai/api/v1` | `packages/core/src/providers/presets/openrouter/index.ts` |
| `nvidia` | `https://integrate.api.nvidia.com/v1` | `packages/core/src/providers/presets/nvidia/index.ts` |
| `opencode-go` | `https://opencode.ai/zen/go/v1` (usage `https://opencode.ai/zen/go/v1/usage`) | `packages/core/src/providers/presets/opencode-go/index.ts` |
| `deepseek` | `https://api.deepseek.com` (balance `https://api.deepseek.com/user/balance`) | `packages/core/src/providers/presets/deepseek/index.ts` |
| `xiaomi` | `https://api.xiaomimimo.com/v1` and `https://api.xiaomimimo.com/anthropic` | `packages/core/src/providers/presets/xiaomi/index.ts` |
| `xiaomi-token-plan-cn` | `https://token-plan-cn.xiaomimimo.com/v1` | same file |
| `xiaomi-token-plan-sgp` | `https://token-plan-sgp.xiaomimimo.com/v1` | same file |
| `xiaomi-token-plan-ams` | `https://token-plan-ams.xiaomimimo.com/v1` | same file |
| `kimi-coding` | `https://api.kimi.com/coding/v1` | `packages/core/src/providers/presets/kimi-coding/index.ts` |
| `zhipu-cn-coding` | `https://open.bigmodel.cn/api/coding/paas/v4` and `https://open.bigmodel.cn/api/anthropic` | `packages/core/src/providers/presets/zhipu-cn-coding/index.ts` |
| `zhipu-cn-general` | `https://open.bigmodel.cn/api/paas/v4` | `packages/core/src/providers/presets/zhipu-cn-general/index.ts` |
| `zai-global-coding` | `https://api.z.ai/api/coding/paas/v4` and `https://api.z.ai/api/anthropic` | `packages/core/src/providers/presets/zai-global-coding/index.ts` |
| `zai-global-general` | `https://api.z.ai/api/paas/v4` | `packages/core/src/providers/presets/zai-global-general/index.ts` |
| `minimax` (global) | `https://api.minimax.io/v1` and `https://api.minimax.io/anthropic/v1` | `packages/core/src/providers/presets/minimax/index.ts` |
| `minimax` (China) | `https://api.minimaxi.com/v1` and `https://api.minimaxi.com/anthropic/v1` | same file |
| `mistral` | `https://api.mistral.ai/v1` | `packages/core/src/providers/presets/mistral/index.ts` |
| `moonshot` (China / global) | `https://api.moonshot.cn/v1`, `https://api.moonshot.ai/v1` | `packages/core/src/providers/presets/moonshot/index.ts` |
| `bailian` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `packages/core/src/providers/presets/bailian/index.ts` |
| `siliconflow` | `https://api.siliconflow.cn/v1` | `packages/core/src/providers/presets/siliconflow/index.ts` |
| `qiniu-ai` | `https://api.qnaigc.com` plus OpenAI and Vertex bypass paths | `packages/core/src/providers/presets/qiniu-ai/index.ts` |
| `fenno` | `https://api.fenno.ai` | `packages/core/src/providers/presets/fenno/index.ts` |
| `infistar-ai` | `https://infistar.ai/v1` | `packages/core/src/providers/presets/infistar-ai/index.ts` |
| `runapi` | `https://runapi.co/v1` | `packages/core/src/providers/presets/runapi/index.ts` |
| `teamorouter` | `https://api.teamorouter.com` | `packages/core/src/providers/presets/teamorouter/index.ts` |
| `unity2` | `https://unity2.ai/v1` | `packages/core/src/providers/presets/unity2/index.ts` |
| `code0` | `https://console.code0.ai` | `packages/core/src/providers/presets/code0/index.ts` |
| `claudeapi` | `https://gw.claudeapi.com` | `packages/core/src/providers/presets/claudeapi/index.ts` |
| `y-api` | `https://api.y-api.bestvirtualgoods.com/v1` | `packages/core/src/providers/presets/y-api/index.ts` |

Auth for these presets is the provider API key stored in `config.sqlite`, sent by the gateway. Official OpenAI key shape is checked in `packages/core/src/providers/presets/openai/index.ts` (`^sk-(?:proj|svcacct)-`). Gemini keys that start with `AIza` are moved to `x-goog-api-key` in `packages/core/src/gateway/core-runtime/upstream-header-sanitizer.ts`.

Users can also add a custom provider with any base URL. That URL is not limited to the table above.

**OpenRouter catalog (extra calls beyond chat):**

- `packages/core/src/providers/openrouter-provider-catalog.ts` fetches `{apiRoot}/api/v1/providers` or the model endpoints path. Cache TTL is 10 minutes. Timeout env: `CCR_OPENROUTER_CATALOG_TIMEOUT_MS` (default 8000 ms).
- Discount routing reads OpenRouter endpoint prices in `packages/core/src/plugins/built-ins/openrouter-discount-provider-router.ts`.
- OpenRouter request URLs are recognized in `packages/core/src/gateway/core-runtime/meta-token-floor.ts` (host `openrouter.ai`).

**Local coding-agent accounts (credential import, not CCR login):**

CCR reads credentials that already exist on the machine and refreshes tokens against the vendor. Implementation is under `packages/core/src/agents/local-providers/`.

| Agent | Upstream | Module |
| --- | --- | --- |
| Claude Code | `https://api.anthropic.com`, usage `https://api.anthropic.com/api/oauth/usage` | `packages/core/src/agents/local-providers/claude-code.ts` |
| Codex | `https://chatgpt.com/backend-api/codex`, account API `https://chatgpt.com/backend-api`. Auth payload key `https://api.openai.com/auth` | `packages/core/src/agents/local-providers/codex.ts` |
| Grok CLI | Chat proxy `https://cli-chat-proxy.grok.com/v1`. Billing `.../v1/billing?format=credits`. Subscription `.../v1/user?include=subscription`. OIDC issuer `https://auth.x.ai` | `packages/core/src/agents/local-providers/grok.ts` |
| Kimi CLI | API `https://api.kimi.com/coding/v1`, platform `https://api.moonshot.ai/v1`, OAuth host `https://auth.kimi.com` (`/api/oauth/token`) | `packages/core/src/agents/local-providers/kimi.ts` |
| OpenCode | `https://opencode.ai/zen/v1` and Go `https://opencode.ai/zen/go/v1` | `packages/core/src/agents/local-providers/opencode.ts` |
| ZCode | `https://zcode.z.ai/api/v1/zcode-plan/anthropic` | `packages/core/src/agents/local-providers/zcode.ts` |

Profile writers point those CLIs at CCR or at the vendor config schema:

- OpenCode schema `https://opencode.ai/config.json` — `packages/core/src/agents/opencode/profile-config.ts`
- Kilo schema `https://app.kilo.ai/config.json` — `packages/core/src/agents/kilo/profile-config.ts`
- Pi — `packages/core/src/agents/pi/profile-config.ts`
- Claude Code settings default `~/.claude/settings.json` — `packages/core/src/config/default-config.ts`
- Codex config default `~/.codex/config.toml` — same file

Grok OIDC refresh uses `GROK_OIDC_CLIENT_ID`, `GROK_OIDC_ISSUER`, `GROK_OIDC_TOKEN_ENDPOINT`, and `GROK_OIDC_REFRESH_TIMEOUT_MS` when set (`packages/core/src/agents/local-providers/grok.ts`). Kimi OAuth host override is `KIMI_CODE_OAUTH_HOST` or `KIMI_OAUTH_HOST`.

**Gateway and protocol runtime:**

- Package `@the-next-ai/ai-gateway`. Release CI checks out `The-NeXT-AI/ai-gateway` at ref `0a2c0abd48d2144ed0ac2ce4d954a661c51ffcb1` and `npm pack`s it (`.github/actions/prepare-release-gateway/action.yml`).
- SDK: npm package `@the-next-ai/ai-gateway`.
- Auth: none for the package itself. Upstream provider keys stay in CCR config. Child process config is passed as `GATEWAY_CONFIG_PATH` (`packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`).

**IM bot gateway (AgentClaw):**

- SDK `@the-next-ai/bot-gateway-sdk` (`packages/core/src/agents/bot-gateway/sdk-import.ts`).
- Platforms normalized in `defaultBotGatewayAuthType` (`packages/core/src/agents/bot-gateway/env.ts`):
  - `slack`, `discord`, `telegram`, `line` — default auth `bot_token`. Slack transport is `socket`; other platforms use `websocket`.
  - `feishu` (alias `lark`), `dingtalk` (alias `dingding`), `wecom` — default auth `app_secret`.
  - `weixin-ilink` (aliases `wechat`, `weixin`, `wx`, `ilink`) — default auth `qr_login`. Streaming replies are forced off.
  - `imessage` — default auth `local`.
- Credentials live in the bot config inside `config.sqlite` and are passed as `CCR_BOT_GATEWAY_CREDENTIALS_JSON`. Webhook-related keys are stripped (`isWebhookRelatedBotGatewayKey` in the same file).
- QR login flow: `packages/core/src/agents/bot-gateway/qr-login-service.ts`.
- Docs list the same platforms in `docs/astro.config.mjs` (`agentClawPlatforms`).

**Plugin marketplace:**

- Default URL `https://raw.githubusercontent.com/musistudio/ccr-extensions/main/marketplace/plugins.json`.
- Override: `CCR_PLUGIN_MARKETPLACE_URL`.
- Client: `fetchWithSystemProxy` in `packages/core/src/plugins/marketplace.ts`. Cache dir is under the data directory `plugin-marketplace/`. TTL 5 minutes. Manifest cap 1 MiB, module cap 8 MiB.

**Model catalog CDN:**

- Runtime download: `https://models.ccrdesk.top/models.json` (`DEFAULT_MODEL_CATALOG_URL` in `packages/core/src/models/catalog-file.ts`).
- Override URL: `CCR_MODEL_CATALOG_URL`. File overrides `CCR_MODEL_CATALOG_PATH` and `CCR_MODELS_JSON_PATH` disable the download.
- Refresh at startup and at most hourly. Cache file: `<runtime data dir>/cache/models.json`. Bundled fallback: `packages/core/models.json`.
- Publish path: `npm run models:update` → `scripts/update-models-cdn.mjs` → `npx wrangler@4 r2 object put`. Auth: Wrangler login, or `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`. Bucket: `CLOUDFLARE_R2_BUCKET`. Object key: `CCR_MODEL_CATALOG_R2_KEY` (default `models.json`). The app does not need R2 credentials to download.

**Static asset CDN:**

- Cloudflare Pages project `claude-code-router-cdn` (`cdn/wrangler.toml`).
- Public files documented in `cdn/README.md`: `https://cdn.ccrdesk.top/ccr-provider-buttons.js`, `https://cdn.ccrdesk.top/ccr-icon.png`.
- Deploy: `npm run deploy` inside `cdn/` (`wrangler pages deploy`). No CDN workflow file exists under `.github/workflows/`. `cdn/README.md` names `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for a GitHub Action; that workflow is not in this repo.

**Desktop update feed:**

- `electron-updater` in `packages/electron/src/main/update-service.ts`.
- Feed: GitHub Releases for `musistudio/claude-code-router` (`electron-builder.json` `publish`).
- `CCR_UPDATE_ALLOW_PRERELEASE` toggles `autoUpdater.allowPrerelease`.
- Docker images do not auto-update (`docker/README.md`).

**Docs site:**

- Built by Astro and deployed to GitHub Pages (`.github/workflows/docs.yml`).
- Site URL `https://ccrdesk.top` (`docs/public/CNAME`, `ASTRO_SITE`).
- Docs content links to GitHub `https://github.com/musistudio/claude-code-router`.

**Browser login import:**

- Chrome extension `extension/chrome/` (Manifest V3, `extension/chrome/manifest.json`).
- It reads cookies and `localStorage` for domains named by a localhost CCR import job and posts them back. Request header on the job fetch: `x-ccr-login-import: chrome-extension` (`extension/chrome/background.js`).
- Content script matches `http://127.0.0.1/*` and `http://localhost/*`.

**System proxy:**

- Optional HTTP proxy in front of upstream calls. Mode is config (`proxy.upstream.mode`: `system` or custom host/port/username/password) in `packages/core/src/config/default-config.ts`.
- Fetch helper: `packages/core/src/proxy/system-proxy-fetch.ts`.
- Explicit upstream proxy URL for the gateway child: `CCR_UPSTREAM_PROXY_URL`.

**MCP:**

Local MCP servers ship in `packages/core/src/mcp/`:

- `toolhub-mcp.ts` — uses the `openai` SDK against the configured gateway base URL.
- `fusion-vision-mcp.ts`, `fusion-tool-fallback-mcp.ts`, `media-tools-proxy-mcp.ts`, `grok-media-mcp.ts`, `browser-web-search-proxy-mcp.ts`, `network-capture-mcp.ts`.

User-defined remote MCP HTTP servers are configuration, not a fixed vendor. Nginx forwards `/mcp/*` to the gateway (`docker/README.md`).

## Data Storage

**Databases:**

- SQLite via `better-sqlite3`. There is no hosted database and no ORM.
- Open helper: `packages/core/src/storage/sqlite-native.ts` (`createBetterSqliteDatabase`).
- Files (`packages/core/src/config/constants.ts`):
  - `config.sqlite` — app config, providers, API keys (`APP_CONFIG_DB_FILE`). Repository: `packages/core/src/config/config-repository.ts`.
  - `request-logs.sqlite` plus body files in `request-log-bodies/` and an admissions DB (`packages/core/src/observability/request-log-runtime.ts`).
  - `usage.sqlite` — token and cost aggregates.
  - `context-archive.sqlite` — context archive snapshots.
  - Plugin-owned `*.sqlite` files opened through `packages/core/src/plugins/backend-service.ts` (permission `sqlite-store`).
- Legacy filenames still migrated: `api-keys.sqlite`, Windows legacy config dir (`LEGACY_API_KEYS_DB_FILES`, `LEGACY_APP_CONFIG_DB_FILES`).
- Docker persists all of this under the named volume `ccr-data` mounted at `/data` (`docker-compose.yml`). `docker/entrypoint.sh` sets `HOME=/data`, so files land in `/data/.claude-code-router/`.
- Connection env: none. Path overrides are `CCR_DATA_DIR` (Docker) and `CCR_INTERNAL_HOME_DIR` / `CCR_INTERNAL_APP_DATA_DIR` / `CCR_INTERNAL_USER_DATA_DIR`.

**File Storage:**

- Local filesystem only for app state: config dir, data dir, `certs/`, `provider-icons/`, `raw-trace-spool/`, `plugin-marketplace/`, model catalog cache.
- Cloudflare R2 stores the published `models.json` object. The running app only downloads it over HTTPS.
- Cloudflare Pages stores the static CDN assets in `cdn/public`.
- GitHub Pages stores the built docs site.
- No S3 SDK in application code.

**Caching:**

- In-process maps: OpenRouter provider catalog (10 minutes) in `packages/core/src/providers/openrouter-provider-catalog.ts`; plugin marketplace (5 minutes) in `packages/core/src/plugins/marketplace.ts`.
- On-disk model catalog cache: `<data>/cache/models.json`.
- HTTP cache header on R2 upload: `public, max-age=300, must-revalidate` (`scripts/update-models-cdn.mjs`).
- No Redis, Memcached, or other shared cache.

## Authentication & Identity

**Auth Provider:**

- Custom. There is no Auth0, Clerk, Cognito, or CCR user directory.
- Management UI: bearer-style shared token.
  - Env: `CCR_WEB_AUTH_TOKEN`.
  - Header: `x-ccr-web-auth` (`packages/core/src/web/management-server.ts`).
  - If unset, the server generates 32 random bytes as base64url. Docker prints `/?ccr_web_token=<token>` once (`docker/entrypoint.sh`). Nginx does not inject the token (`docker/README.md`).
  - Browser query name: `ccr_web_token`.
- Management service instances can also match `CCR_SERVICE_INSTANCE_TOKEN` (`packages/core/src/web/management-server.ts`).
- Model gateway clients use CCR API keys stored in `config.sqlite` (`packages/core/src/config/config-repository.ts`, `replaceApiKeys`). These keys are distinct from upstream provider keys. Gateway code reads `x-auth-api-key-id` (`packages/core/src/gateway/claude-code-router-plugin.ts`).
- Upstream providers use API keys or OAuth tokens imported from local CLIs (table above). Claude Code OAuth plugins are detected by `packages/core/src/providers/oauth-plugin.ts` (plugin key prefix `ccr-local-agent-` and `claude-code-oauth`).
- Desktop deep link `ccr://provider` imports a provider definition (`appDeepLinkProtocol` in `packages/core/src/contracts/deep-link.ts`; scheme registered in `electron-builder.json`).
- Bot credentials are per-platform tokens or app secrets inside bot config. They are not a CCR identity provider.

## Monitoring & Observability

**Error Tracking:**

- None. No Sentry, Datadog, Bugsnag, or OpenTelemetry exporter.

**Logs:**

- `console.warn` / `console.error` for catalog, marketplace, and gateway bootstrap failures (`packages/core/src/models/catalog-file.ts`, `packages/core/src/plugins/marketplace.ts`, `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`).
- Structured request logs in SQLite when `observability.requestLogs` is enabled (`packages/core/src/config/default-config.ts` defaults `requestLogs` to false). Writer: `packages/core/src/observability/request-log-runtime.ts`. Bodies: `packages/core/src/observability/request-log-body.ts`.
- Optional raw trace spool: `CCR_RAW_TRACE` / `CCR_RAW_TRACE_ENABLED` (`packages/core/src/observability/raw-trace-sync.ts`). Internal sync path: `/__ccr/raw-trace-sync` (`packages/core/src/gateway/internal/shared.ts`).
- Docker: container stdout from PM2 and Nginx. Health check hits `http://127.0.0.1:$CCR_NGINX_PORT/` (`Dockerfile`). Gateway health route is `/health` and can return 502 until the gateway is configured (`docker/README.md`).
- electron-updater logs through the logger assigned in `packages/electron/src/main/update-service.ts`.

## CI/CD & Deployment

**Hosting:**

- Desktop binaries: GitHub Releases (`musistudio/claude-code-router`), produced by `.github/workflows/release.yml` on tags `v*`.
- Container: Docker Hub `musistudio/claude-code-router` (`latest`, version, and major.minor tags) via `.github/workflows/docker-release.yml` (`workflow_dispatch` only).
- Docs: GitHub Pages environment `github-pages`, custom domain `ccrdesk.top` (`docs/public/CNAME`).
- CDN assets: Cloudflare Pages `claude-code-router-cdn` (manual `wrangler pages deploy`).
- Model catalog: Cloudflare R2 behind `models.ccrdesk.top` (manual `npm run models:update`).

**CI Pipeline:**

- `.github/workflows/release.yml` — on `v*` tags. Jobs: model catalog artifact, gateway tarball from `The-NeXT-AI/ai-gateway`, macOS arm64 (`macos-14`) and Intel (`macos-15-intel`), plus Windows/Linux artifact jobs later in the same file. Node 22, `npm ci`. Permission `contents: write`.
- `.github/workflows/docker-release.yml` — manual. QEMU, Buildx, `docker/login-action`, `docker/build-push-action`. Secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`. Platforms `linux/amd64`, `linux/arm64`.
- `.github/workflows/docs.yml` — push to `main` when `docs/**` or the workflow file changes, or `workflow_dispatch`. `withastro/action@v6`, Node 24, deploy `actions/deploy-pages@v5`.
- No pull-request test workflow is present. Tests run locally: `npm test`, `npm run test:e2e`, `npm run test:system`.

Local compose (`docker-compose.yml`) builds `claude-code-router:local` and does not push.

## Environment Configuration

**Required env vars:**

None are required for a local desktop or CLI run. The process generates a management token and uses `127.0.0.1` defaults.

Required for specific deploy paths:

- Docker remote or stable admin URL: `CCR_WEB_AUTH_TOKEN`, `CCR_PUBLIC_BASE_URL` (`docker/README.md`).
- Docker Hub release: `DOCKER_USERNAME`, `DOCKER_PASSWORD` (GitHub Actions secrets).
- R2 catalog upload: `CLOUDFLARE_R2_BUCKET`, plus `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` when Wrangler is not already logged in.
- Docs production URL is set in the workflow as `ASTRO_SITE=https://ccrdesk.top` (optional locally; default is the same URL in `docs/astro.config.mjs`).

**Secrets location:**

- Provider API keys, CCR client API keys, and bot credentials: SQLite `config.sqlite` under the config directory (`packages/core/src/config/constants.ts`).
- Local CLI OAuth material: the vendor's own files (Codex `~/.codex`, Grok `GROK_AUTH_FILE` / `GROK_HOME`, Kimi credential files). CCR reads them; it does not replace those stores.
- Proxy CA private key: `certs/key.pem` mode `0o600` (`packages/core/src/proxy/certificates.ts`).
- GitHub Actions secrets for Docker Hub and, when used outside this repo's workflows, Cloudflare tokens. Do not put those values in the repository.
- A root `.env` is optional for `npm run models:update` only. It is not present in the tree scanned for this document.
- `.npmrc` is present. Contents were not read.

## Webhooks & Callbacks

**Incoming:**

- No public webhook receiver for IM. Bot gateway config drops keys whose names contain `webhook` or equal `sendmode`, and forces Socket Mode (`slack`) or WebSocket (other platforms) in `packages/core/src/agents/bot-gateway/env.ts`.
- Management RPC: `POST` style JSON RPC at `/api/ccr/rpc`, authenticated with `x-ccr-web-auth` (`packages/core/src/web/management-server.ts`, route table in `docker/README.md`).
- Model and MCP HTTP on the gateway: `/v1/*`, `/v1beta/*`, `/messages`, `/chat/completions`, `/responses`, `/interactions`, `/mcp/*` (Nginx routes in `docker/README.md`). Default bind `127.0.0.1:3456`.
- Internal loopback callbacks from the gateway child: `/__ccr/raw-trace-sync` and `/__ccr/billing-usage-sync` (`packages/core/src/gateway/internal/shared.ts`).
- Desktop protocol `ccr://` (provider import). Parser: `packages/core/src/contracts/deep-link.ts`. Electron registration: `electron-builder.json` `protocols`.
- Chrome extension calls a localhost import URL and submits cookies back to that same CCR origin (`extension/chrome/background.js`). Host permission is limited to the extension talking to sites the user approves; the CCR endpoint itself is on `127.0.0.1` or `localhost`.
- Claude desktop app can be attached with the Chrome DevTools protocol. Port override: `CCR_CLAUDE_APP_CDP_PORT` (`packages/core/src/agents/claude-app/cdp.ts`).

**Outgoing:**

- Upstream LLM HTTP(S) to the provider base URL in effect (preset table or a custom URL), through `@the-next-ai/ai-gateway` and optional `CCR_UPSTREAM_PROXY_URL`.
- OpenRouter catalog and activity endpoints from `packages/core/src/providers/openrouter-provider-catalog.ts`.
- OAuth token refresh: Grok (`https://auth.x.ai` or `GROK_OIDC_TOKEN_ENDPOINT`), Kimi (`https://auth.kimi.com/api/oauth/token`).
- Account usage and billing: Anthropic usage URL, DeepSeek balance URL, Grok billing and subscription URLs, OpenCode Go usage URL (modules cited above).
- Plugin marketplace GET to GitHub raw content (`packages/core/src/plugins/marketplace.ts`).
- Model catalog GET to `https://models.ccrdesk.top/models.json` (`packages/core/src/models/catalog-file.ts`).
- Desktop update metadata and artifacts from GitHub Releases (`packages/electron/src/main/update-service.ts`).
- IM platforms via `@the-next-ai/bot-gateway-sdk` WebSocket or Slack Socket Mode, using the credentials in bot config. CCR does not hard-code Slack, Discord, or Telegram HTTP webhook URLs.
- System browser and external app launches go through `openSystemExternal` in `packages/core/src/web/management-server.ts` (provider websites stored on each preset as `websiteUrl`).

---

*Integration audit: 2026-11-14*

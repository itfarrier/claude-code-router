---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# Technology Stack

**Analysis Date:** 2026-11-14

## Languages

**Primary:**

- TypeScript 5.9 (`typescript` `^5.9.3` in root `package.json`) — application source under `packages/core/src`, `packages/cli/src`, `packages/electron/src`, and `packages/ui/src`. Compiler settings live in `tsconfig.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `module`/`moduleResolution` `NodeNext`, `target` `ESNext`, `jsx` `react-jsx`, `noEmit`.
- JavaScript (ESM `.mjs` and CJS `.cjs`) — build, test runner, Docker, and release scripts in `build/`, `scripts/`, and `docker/`.

**Secondary:**

- TSX — React UI in `packages/ui/src` and Playwright specs in `tests/e2e/*.spec.ts`.
- HTML/CSS — UI shells `packages/ui/src/pages/home/index.html` and `packages/ui/src/pages/tray/index.html`; styles in `packages/ui/src/styles/globals.css`.
- Astro + Markdown — documentation site in `docs/` (`docs/package.json`, `docs/astro.config.mjs`).
- Shell — `docker/entrypoint.sh`.
- JSON — app manifests, Electron Builder config (`electron-builder.json`), bundled plugin manifests under `packages/electron/bundled-plugins/*/plugin.json`, Chrome extension `extension/chrome/manifest.json` (Manifest V3).
- Nginx config is generated at container start by `docker/entrypoint.sh`.

Plain JavaScript without a package manifest: `extension/chrome/` (Chrome extension service worker `extension/chrome/background.js`).

## Runtime

**Environment:**

- Node.js `>=22` (`engines.node` in root `package.json`, `packages/core/package.json`, and `packages/cli/package.json`).
- GitHub Actions app jobs use Node 22 (`actions/setup-node@v4`, `node-version: 22`) in `.github/workflows/release.yml` and `.github/actions/prepare-release-gateway/action.yml`.
- Docs workflow uses Node 24 (`actions/setup-node@v6`) in `.github/workflows/docs.yml`.
- Docker build and runtime images are `node:22-bookworm-slim` (`Dockerfile` `ARG NODE_IMAGE` / `ARG RUNTIME_NODE_IMAGE`).
- Electron `^42.3.3` is the desktop shell. Packaged app id is `com.claudecoderouter.desktop` (`electron-builder.json`).
- No `.nvmrc` or `.node-version` file.

**Package Manager:**

- npm. Install and CI commands are `npm ci` (`Dockerfile`, `.github/workflows/release.yml`, `.github/workflows/docs.yml`). Root scripts in `package.json` call `npm run`.
- Lockfile: present. Canonical install lockfile is root `package-lock.json` (`lockfileVersion` 3). `docs/package-lock.json` locks the docs site separately.
- A second lockfile, `pnpm-lock.yaml` (`lockfileVersion` 9.0), is present at the repo root. Docker, release, and docs workflows do not run `pnpm install`. Use `npm ci` and `package-lock.json` for installs.
- npm workspaces are `"packages/*"` in root `package.json`. `docs/`, `cdn/`, and `extension/chrome/` are outside the workspace.
- `.npmrc` exists at the repo root. Contents were not read.

Workspace packages (all version `3.1.3`):

| Package | Path | Role |
| --- | --- | --- |
| `claude-code-router-monorepo` (private root) | `package.json` | Scripts, Electron packaging, shared dependency versions |
| `@claude-code-router/core` (private) | `packages/core` | Gateway, routing, providers, SQLite, management server. Bin `ccr-core-server` → `dist/main/server.js` |
| `@musistudio/claude-code-router` (public) | `packages/cli` | Published CLI. Bin `ccr` → `dist/main/cli.js` |
| `@claude-code-router/ui` (private) | `packages/ui` | React management UI and tray |
| `@claude-code-router/electron` (private) | `packages/electron` | Electron main process. `main`: `dist/main/main.js` |
| `claude-code-router-docs` (private, own lockfile) | `docs/package.json` | Astro docs site |
| `claude-code-router-cdn` (private, no dependencies) | `cdn/package.json` | Cloudflare Pages static assets |

## Frameworks

**Core:**

- `@the-next-ai/ai-gateway` `^1.0.21` — upstream model-protocol runtime. CCR supervises it as a child process. Entry resolution is in `packages/core/src/gateway/internal/shared.ts` (`gatewayPackageCandidates = ["@the-next-ai/ai-gateway", "gateway"]`). Process spawn and env are in `packages/core/src/gateway/core-runtime/supervisor.ts`. The child boots through `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`, which sets `GATEWAY_CONFIG_PATH` and `require`s the gateway entry. Release builds pin upstream source to git ref `0a2c0abd48d2144ed0ac2ce4d954a661c51ffcb1` of `The-NeXT-AI/ai-gateway` (`.github/actions/prepare-release-gateway/action.yml`) and pack a tarball into `docker/local-ai-gateway/`.
- `@the-next-ai/bot-gateway-sdk` `^0.1.0` — IM bot runtime. Import helper: `packages/core/src/agents/bot-gateway/sdk-import.ts`. esbuild copies the SDK into the Electron main bundle (`build/esbuild.config.mjs`, `electronBotGatewaySdkRootDir`).
- React `^18.3.1` and `react-dom` `^18.3.1` — management UI (`packages/ui/package.json`). Entry pages: `packages/ui/src/pages/home/main.tsx`, `packages/ui/src/pages/tray/main.tsx`.
- Base UI `baseui` `^16.1.1` with Styletron (`styletron-engine-atomic` `^1.6.2`, `styletron-react` `^6.1.1`) — UI primitives. Tailwind CSS `^4.3.0` (`@tailwindcss/cli` `^4.3.0`) and `tailwind-merge` `^3.6.0` style the same UI. `components.json` records a shadcn schema (`style: new-york`, CSS `packages/ui/src/styles/globals.css`, icons `lucide`). App components live in `packages/ui/src/components` and `packages/ui/src/pages/home/components`.
- Motion `motion` `^12.40.0`, Recharts `^3.8.1`, `@dnd-kit/core` `^6.3.1` — animation, charts, and drag-and-drop in the UI package.
- Astro `7.0.0` with `@astrojs/react` `^6.0.2` and `@astrojs/sitemap` `^3.7.3` — static docs (`docs/package.json`, `docs/astro.config.mjs`, `output: "static"`).
- Electron `^42.3.3` — desktop host. Main process starts at `packages/electron/src/main/main.ts` and then loads `packages/electron/src/main/main-app.js`.

**Testing:**

- Node.js built-in test runner (`node --test`) plus `node:assert/strict`. `build/test.mjs` bundles tests with esbuild into `.test-dist/`. `build/run-tests.mjs` spawns `node --test` (or Electron with `ELECTRON_RUN_AS_NODE=1` for the electron project, with a node-with-electron fallback for core).
- Playwright `@playwright/test` `^1.61.1` — end-to-end tests. Config: `playwright.config.ts` (`testDir: ./tests/e2e`, Chromium project, `workers: 1`). Run with `npm run test:e2e`.
- Docker smoke: `tests/system/docker-smoke.mjs` via `npm run test:system`.
- No Jest, Vitest, Mocha, or Cypress config in this repo. The release gateway action runs Vitest only inside the checked-out `ai-gateway` tree (`.github/actions/prepare-release-gateway/action.yml`).

**Build/Dev:**

- esbuild `^0.27.7` — production and dev bundles (`build/esbuild.config.mjs`, `build/build.mjs`, `build/dev.mjs`).
- `tsc --noEmit` — `npm run typecheck` (root `package.json`). `prepublishOnly` runs typecheck.
- electron-builder `^26.8.1` — desktop artifacts. Config: `electron-builder.json`. Local overrides: `build/electron-builder.local.cjs`. Scripts: `build:app:mac:*`, `build:app:win:*`.
- `@electron/rebuild` is invoked by `npm run rebuild:sqlite3` (`electron-rebuild -f -w better-sqlite3`) so `better-sqlite3` matches the Electron ABI.
- electron-updater `^6.8.9` — packaged-app updates (`packages/electron/src/main/update-service.ts`). Publish target is GitHub Releases (`electron-builder.json` `publish.provider: github`, owner `musistudio`, repo `claude-code-router`).
- Docker — `Dockerfile`, `docker-compose.yml`, `build/docker-image.mjs`, `build/docker-compose.mjs`, `build/docker-build.mjs`. Runtime process manager inside the image is PM2 (`pm2` `^7.0.3`, `docker/pm2.config.cjs`). Public HTTP inside the image is Nginx (installed in `Dockerfile`).
- Wrangler is not a dependency. CDN and R2 commands call `npx wrangler` / `npx wrangler@4` (`cdn/package.json`, `scripts/update-models-cdn.mjs`).

Root script map (from `package.json`):

```bash
npm run dev              # node build/dev.mjs cli
npm run dev:ui           # UI dev server
npm run dev:electron     # Electron dev
npm run build            # esbuild assets, then electron-builder
npm run typecheck        # tsc --noEmit
npm test                 # workspace tests + architecture tests
npm run test:e2e         # build assets, then playwright test
npm run docker:compose:up
npm run models:build     # node scripts/generate-models-json.mjs
npm run models:update    # generate catalog and upload to R2
```

## Key Dependencies

**Critical:**

- `@the-next-ai/ai-gateway` `^1.0.21` — speaks OpenAI, Anthropic, Gemini, and related upstream protocols. CCR owns routing, auth injection, and request logs around it (`packages/core/src/gateway/core-runtime/router-plugin.ts`, `packages/core/src/gateway/core-runtime/upstream-header-sanitizer.ts`).
- `@the-next-ai/bot-gateway-sdk` `^0.1.0` — Slack, Discord, Telegram, LINE, Weixin iLink, WeCom, Feishu, DingTalk, and iMessage session bridge. Platform normalization is in `packages/core/src/agents/bot-gateway/env.ts`.
- `better-sqlite3` `^12.11.1` — local databases. Native open helper: `packages/core/src/storage/sqlite-native.ts`. File paths: `packages/core/src/config/constants.ts`.
- `undici` `^7.29.0` — upstream HTTP proxy agent (`packages/core/src/proxy/undici-proxy-agent.ts`). The gateway supervisor passes `CCR_UNDICI_MODULE` into the child (`packages/core/src/gateway/core-runtime/supervisor.ts`).
- `openai` `^6.27.0` — OpenAI SDK client used by ToolHub MCP (`packages/core/src/mcp/toolhub-mcp.ts` imports `OpenAI`).
- `node-forge` `^1.4.0` — local proxy CA and leaf certificates (`packages/core/src/proxy/certificates.ts`).
- `pm2` `^7.0.3` — keeps the core server running in the Docker image (`docker/pm2.config.cjs`).
- `electron-updater` `^6.8.9` — desktop auto-update against GitHub Releases.

**Infrastructure:**

- Nginx — only published port inside Docker (`Dockerfile` installs `nginx`; `docker/entrypoint.sh` writes the server block). Default public mapping is host `3458` → container `8080` (`docker-compose.yml`).
- Docker Hub image name `musistudio/claude-code-router` (`.github/workflows/docker-release.yml`).
- GitHub Releases — desktop artifacts and electron-updater feed.
- GitHub Pages — docs site `https://ccrdesk.top` (`docs/public/CNAME`, `.github/workflows/docs.yml`).
- Cloudflare Pages project `claude-code-router-cdn` (`cdn/wrangler.toml`, `cdn/package.json`) for `https://cdn.ccrdesk.top`.
- Cloudflare R2 — public model catalog `https://models.ccrdesk.top/models.json` (`packages/core/src/models/catalog-file.ts`, `scripts/update-models-cdn.mjs`).

UI libraries that ship in the renderer bundle (declared on `@claude-code-router/ui`, also hoisted as root devDependencies): `clsx` `^2.1.1`, `lucide-react` `^1.17.0`, `@musistudio/lucide-morph-react` `^1.0.0` (UI package only). Docs also use `lucide-astro` `^0.556.0` and Tailwind via `@tailwindcss/vite` `^4.3.3`.

`js-yaml` `^4.3.1` is a root devDependency used by build tooling. Root `overrides` pin `fast-uri`, `find-my-way`, `js-yaml`, `brace-expansion`, and `ip-address` (`package.json`).

## Configuration

**Environment:**

No committed `.env` file is present at the repo root. `scripts/update-models-cdn.mjs` calls `process.loadEnvFile` on a root `.env` when that file exists (ENOENT is ignored). Do not commit that file. `.npmrc` exists; its contents were not read.

Runtime configuration is a SQLite database, not dotenv. Defaults are in `packages/core/src/config/default-config.ts`. Paths are resolved in `packages/core/src/runtime/app-paths.ts` and `packages/core/src/config/constants.ts`:

- Config directory: `~/.claude-code-router` on non-Windows (`APP_STORAGE_NAME` `claude-code-router`; Windows uses app data).
- `config.sqlite` — app config and API keys (`APP_CONFIG_DB_FILE`).
- Data directory SQLite files: `request-logs.sqlite`, `usage.sqlite`, `context-archive.sqlite`.
- Proxy CA material: `certs/ca.pem`, `certs/ca.cer`, `certs/key.pem`.

Default listeners (`packages/core/src/config/default-config.ts`, `packages/core/src/web/management-server.ts`):

| Surface | Default |
| --- | --- |
| Public model gateway | `127.0.0.1:3456` (`gateway.port`) |
| Internal gateway core | port `3457` (`gateway.corePort`) |
| Management UI / RPC | `127.0.0.1:3458` (`CCR_WEB_HOST` / `CCR_WEB_PORT`) |
| Optional local proxy | `127.0.0.1:7890` (`proxy.port`), disabled by default |
| Docker Nginx | container `8080`, published as host `3458` |
| Docker internal web | `127.0.0.1:3459` (`CCR_WEB_PORT` inside the image) |

TypeScript path aliases in `tsconfig.json`:

- `@/*` and `@ccr/ui/*` → `packages/ui/src/*`
- `@ccr/core/*` → `packages/core/src/*`
- `@ccr/cli/*` → `packages/cli/src/*`
- `@ccr/electron/*` → `packages/electron/src/*`

Docs Vite aliases in `docs/astro.config.mjs` map `@` to `packages/ui/src` and `@ccr/core` to `packages/core/src`.

**Build:**

- `tsconfig.json` — typecheck the packages and `tests/e2e`. `noEmit: true`.
- `tsconfig.node.json` — composite project that includes `playwright.config.ts`.
- Per-package `tsconfig.json` files: `packages/core/tsconfig.json`, `packages/cli/tsconfig.json`, `packages/ui/tsconfig.json`, `packages/electron/tsconfig.json`, `docs/tsconfig.json`.
- `build/esbuild.config.mjs` — bundle inputs and outputs for CLI, core, Electron, and UI.
- `electron-builder.json` — macOS (dmg + zip, hardened runtime, notarize), Windows NSIS x64, Linux AppImage. Protocol scheme `ccr`.
- `Dockerfile` — multi-stage Node 22 image. Build stage may install `docker/local-ai-gateway/*.tgz` over the registry copy of `@the-next-ai/ai-gateway`.
- `cdn/wrangler.toml` — Pages project `claude-code-router-cdn`, `pages_build_output_dir = "./public"`, `compatibility_date = "2026-06-28"`.
- `playwright.config.ts` — e2e runner.
- No ESLint, Prettier, or Biome config file is present.

Key environment variables (names only; set them in the process environment or a private env file):

- Process and ports: `CCR_WEB_HOST`, `CCR_WEB_PORT`, `CCR_WEB_AUTH_TOKEN`, `CCR_GATEWAY_HOST`, `CCR_GATEWAY_PORT`, `CCR_GATEWAY_ENTRY`, `CCR_PUBLIC_BASE_URL`, `CCR_PUBLIC_HOST`, `CCR_PUBLIC_PORT`, `CCR_NGINX_PORT`, `CCR_NO_GATEWAY`, `CCR_DATA_DIR`, `CCR_NODE_BIN`.
- Data location overrides: `CCR_INTERNAL_HOME_DIR`, `CCR_INTERNAL_APP_DATA_DIR`, `CCR_INTERNAL_USER_DATA_DIR`.
- Model catalog: `CCR_MODEL_CATALOG_URL`, `CCR_MODEL_CATALOG_PATH`, `CCR_MODELS_JSON_PATH`, `CLOUDFLARE_R2_BUCKET`, `CCR_MODEL_CATALOG_R2_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Plugins and extensions: `CCR_PLUGIN_MARKETPLACE_URL`, `CCR_EXTENSIONS_DIR`.
- Upstream HTTP: `CCR_UPSTREAM_PROXY_URL`, `CCR_UPSTREAM_TIMEOUT_MS`, `CCR_UNDICI_MODULE`.
- Desktop updates: `CCR_UPDATE_ALLOW_PRERELEASE`.
- Docs build: `ASTRO_SITE` (default `https://ccrdesk.top`), `ASTRO_BASE`.
- Local-agent credential files also honor upstream CLI variables such as `GROK_HOME`, `GROK_OIDC_ISSUER`, `GROK_OIDC_TOKEN_ENDPOINT`, `KIMI_CODE_HOME`, `KIMI_CODE_OAUTH_HOST` (`packages/core/src/agents/local-providers/grok.ts`, `packages/core/src/agents/local-providers/kimi.ts`).

## Platform Requirements

**Development:**

- Node.js 22 or newer and npm. `npm ci` at the repo root installs workspaces.
- A C++ toolchain is required when `better-sqlite3` builds native bindings. Electron builds also need `npm run rebuild:sqlite3` after switching Electron versions.
- macOS desktop release needs Apple code signing and notarization (`electron-builder.json` `mac.hardenedRuntime`, `mac.notarize`, `build/verify-macos-notarization.cjs`, `build/macos-release-preflight.mjs`).
- Windows packaging runs `build/windows-package-preflight.mjs` before `electron-builder --win`.
- Playwright Chromium: `npm run test:e2e:install`.
- Docker Desktop or a compatible engine for `npm run docker:compose:up`. The compose helper expects a local gateway checkout prepared by `npm run docker:prepare-gateway` (`docker/README.md`).
- Docs: `npm ci` inside `docs/` (separate lockfile) or the docs workflow path. Dev command: `astro dev` (`docs/package.json`).
- Python is not a project runtime. No `pyproject.toml`, `requirements.txt`, `Cargo.toml`, or `go.mod`.

**Production:**

- Desktop: Electron app built by electron-builder. macOS arm64 and x64, Windows x64 NSIS, Linux AppImage (`electron-builder.json`, `.github/workflows/release.yml`). Updates come from GitHub Releases via `electron-updater`.
- CLI: npm package `@musistudio/claude-code-router` (`packages/cli/package.json`, `publishConfig.access: public`). Users run the `ccr` bin. Management UI defaults to `http://127.0.0.1:3458`. Gateway defaults to `http://127.0.0.1:3456`.
- Server: Docker image `musistudio/claude-code-router` for `linux/amd64` and `linux/arm64` (`.github/workflows/docker-release.yml`). The image does not include Electron or the `ccr` npm bin (`docker/README.md`). Persistent volume is `/data` (`CCR_DATA_DIR`).
- Docs: GitHub Pages at `https://ccrdesk.top`.
- Static CDN: Cloudflare Pages `claude-code-router-cdn`. Model catalog object: Cloudflare R2, public host `models.ccrdesk.top`.

---

*Stack analysis: 2026-11-14*

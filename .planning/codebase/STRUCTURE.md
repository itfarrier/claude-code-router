---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# Codebase Structure

**Analysis Date:** 2026-11-14

## Directory Layout

```
claude-code-router/
├── package.json                 # Workspace root, app scripts, Electron main
├── package-lock.json            # npm lockfile used by CI and Docker
├── pnpm-lock.yaml               # Present lockfile; npm is the workspace runner
├── tsconfig.json                # Path aliases for @ccr/* and @/*
├── tsconfig.node.json           # Node config project reference
├── electron-builder.json        # Desktop packager (app dir packages/electron)
├── playwright.config.ts         # Repo e2e runner
├── Dockerfile                   # Multi-stage image for the core server
├── docker-compose.yml           # Publishes host 3458 to container Nginx 8080
├── components.json              # UI component generator config
├── packages/
│   ├── core/                    # Domain: gateway, config, routing, storage
│   ├── electron/                # Desktop shell
│   ├── cli/                     # `ccr` bin
│   └── ui/                      # React management UI
├── build/                       # esbuild, electron-builder, Docker, test runner
├── tests/
│   ├── architecture/            # Package-boundary checks
│   ├── e2e/                     # Playwright
│   └── system/                  # Docker smoke
├── docs/                        # Astro documentation site (not a workspace)
├── cdn/                         # Cloudflare Pages embed button (not a workspace)
├── docker/                      # Docker notes and local ai-gateway drop
├── extension/chrome/            # Unpacked Chrome login-import extension
├── examples/routing/            # Sample route script
├── scripts/                     # Model catalog and generated UI data
├── blog/                        # Release images and posts
└── .github/workflows/           # Release, Docker, and docs workflows
```

`package.json` workspaces are only `packages/*`. Add runtime code there. `docs/` and `cdn/` have their own `package.json` files and their own install.

## Directory Purposes

**`packages/core/src/`:**

- Purpose: All gateway, config, routing, provider, profile, plugin, proxy, MCP, log, and usage behavior.
- Contains: TypeScript modules grouped by area. No React and no Electron imports.
- Key files: `entrypoints/server.ts`, `gateway/service.ts`, `gateway/application/gateway-service.ts`, `config/config.ts`, `contracts/app.ts`, `web/management-server.ts`

**`packages/core/src/gateway/`:**

- Purpose: Process ownership and the HTTP request path.
- Contains: `application/` (lifecycle), `http/` (request I/O), `request/` (pipeline), `core-runtime/` (child process and router plugin), `features/` (protocol transforms), `auth/`, `upstream/`, `limits/`, `context-archive/`, `internal/`.
- Key files: `service.ts` (re-exports only), `application/gateway-service.ts`, `http/request-handler.ts`, `request/pipeline.ts`, `core-runtime/router-plugin.ts`, `claude-code-router-plugin.ts`

**`packages/core/src/routing/`:**

- Purpose: Decide which provider model handles a request.
- Contains: Rule compile, policy engine, rewrites, model registry, protocol adapter, route-script worker.
- Key files: `config-compiler.ts`, `policy-engine.ts`, `execution-plan.ts`, `model-registry.ts`, `protocol-endpoints.ts`, `route-script-runtime.ts`

**`packages/core/src/providers/`:**

- Purpose: Presets, catalogs, credential pools, account snapshots, and connectivity probes.
- Contains: `presets/<id>/index.ts` plus shared helpers.
- Key files: `presets/index.ts`, `presets/types.ts`, `credential-pool.ts`, `account-service.ts`, `probe.ts`, `model-catalog.ts`

**`packages/core/src/agents/`:**

- Purpose: Per-agent config writers, launchers, and local-login importers.
- Contains: `claude-code/`, `claude-app/`, `codex/`, `opencode/`, `kilo/`, `pi/`, `zcode/`, `bot-gateway/`, `local-providers/`.
- Key files: `request-enricher.ts`, `local-providers/service.ts`, `claude-app/gateway-service.ts`, `codex/app-launch.ts`

**`packages/core/src/profiles/`:**

- Purpose: Apply a saved profile to an agent and launch it.
- Contains: Config writers orchestration and launch planning.
- Key files: `service.ts`, `launch-service.ts`, `launch-core.ts`, `model-allowlist.ts`, `api-key.ts`

**`packages/core/src/plugins/`:**

- Purpose: Load user plugins and built-in transforms.
- Contains: The plugin host and `built-ins/`.
- Key files: `service.ts`, `backend-service.ts`, `marketplace.ts`, `built-ins/openrouter-discount-provider-router.ts`

**`packages/core/src/mcp/`:**

- Purpose: MCP servers the gateway exposes to agents (ToolHub, Fusion vision, media, web search, network capture).
- Contains: One server or config module per file.
- Key files: `toolhub-mcp.ts`, `toolhub-config.ts`, `fusion-vision-mcp.ts`, `fusion-tool-fallback-mcp.ts`, `media-tools-proxy-mcp.ts`, `browser-web-search-proxy-mcp.ts`, `network-capture-mcp.ts`

**`packages/core/src/config/`, `storage/`, `observability/`, `usage/`, `models/`:**

- Purpose: Paths, SQLite, request logs, token stats, and the model price catalog.
- Contains: Repositories and workers.
- Key files: `config/constants.ts`, `config/config-repository.ts`, `config/default-config.ts`, `storage/sqlite-native.ts`, `observability/request-log-store.ts`, `observability/request-log-worker.ts`, `usage/store.ts`, `models/catalog-file.ts`, `models/pricing-service.ts`

**`packages/core/src/web/`, `proxy/`, `media/`, `platform/`, `runtime/`, `contracts/`:**

- Purpose: Management HTTP, optional MITM proxy, media tools, OS helpers, path overrides, and shared types.
- Key files: `web/management-server.ts`, `proxy/service.ts`, `media/service.ts`, `runtime/app-paths.ts`, `runtime/desktop-app.ts`, `contracts/app.ts`, `contracts/ipc-channels.ts`, `contracts/i18n.ts`, `platform/socket-compat.ts`

**`packages/electron/src/main/`:**

- Purpose: Desktop-only process. Windows, IPC, tray, updates, deep links, in-app browser, Chrome cookie import.
- Contains: One module per OS integration. Import core services; do not reimplement them.
- Key files: `main.ts`, `main-app.ts`, `ipc.ts`, `preload.ts`, `windows.ts`, `tray-controller.ts`, `update-service.ts`, `deep-link.ts`, `built-in-browser.ts`

**`packages/electron/bundled-plugins/`:**

- Purpose: Plugins shipped inside the desktop app.
- Contains: `claude-design/`, `claude-ship/`, `new-api-account/`.
- Key files: Each plugin's own entry, copied by `build/esbuild.config.mjs` to `packages/electron/dist/bundled-plugins`.

**`packages/cli/src/`:**

- Purpose: The published `ccr` command.
- Contains: A single entry, `cli.ts`.
- Key files: `packages/cli/src/cli.ts`, `packages/cli/package.json` (`bin.ccr`)

**`packages/ui/src/pages/home/`:**

- Purpose: The management UI.
- Contains: `App.tsx` (screen state), `components/` (views), `shared/` (drafts, normalization, polling).
- Key files: `main.tsx`, `App.tsx`, `index.html`, `components/index.ts`, `shared/index.tsx`, `shared/config.ts`, `shared/providers.ts`, `shared/routing.ts`, `shared/profiles.ts`

**`packages/ui/src/pages/tray/` and `pages/browser/`:**

- Purpose: Tray popover and in-app browser renderer.
- Contains: Their own `main.tsx` and components.
- Key files: `pages/tray/TrayApp.tsx`, `pages/browser/main.tsx`

**`packages/ui/src/components/ui/`:**

- Purpose: Shared visual primitives (button, dialog, input, tabs).
- Contains: One component per file.
- Key files: `button.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `tabs.tsx`

**`build/`:**

- Purpose: Compile every package and run tests. There is no per-package bundler config.
- Contains: esbuild option builders and packaging scripts.
- Key files: `esbuild.config.mjs`, `build.mjs`, `dev.mjs`, `test.mjs`, `run-tests.mjs`, `docker-image.mjs`, `electron-builder.local.cjs`

**`tests/`:**

- Purpose: Checks that do not belong to one package.
- Contains: Architecture, Playwright, and Docker smoke.
- Key files: `tests/architecture/package-boundaries.test.mjs`, `tests/e2e/`, `tests/system/docker-smoke.mjs`

**`docs/` and `cdn/`:**

- Purpose: Public documentation site and the embeddable provider-import button.
- Contains: Astro sources under `docs/src/` and the Pages asset under `cdn/`.
- Key files: `docs/package.json`, `cdn/wrangler.toml`, `cdn/README.md`

## Key File Locations

**Entry Points:**

- `packages/electron/src/main/main.ts`: Desktop process start.
- `packages/electron/src/main/main-app.ts`: Window, tray, and service start after Electron is ready.
- `packages/cli/src/cli.ts`: `ccr` command.
- `packages/core/src/entrypoints/server.ts`: `ccr-core-server` and the Docker core process.
- `packages/ui/src/pages/home/main.tsx`: Management UI mount.
- `packages/ui/src/pages/tray/main.tsx`: Tray UI mount.
- `packages/ui/src/pages/browser/main.tsx`: In-app browser mount.
- `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`: ai-gateway child start.
- `packages/core/src/gateway/core-runtime/router-plugin.ts`: Routing plugin loaded by that child.
- `Dockerfile`: Image build. Nginx is the published entry; the core server listens inside the container.

**Configuration:**

- `package.json`: Scripts `dev`, `build`, `test`, `docker:*`, and the workspace list.
- `tsconfig.json`: `@ccr/core/*` → `packages/core/src/*`, `@/*` → `packages/ui/src/*`.
- `electron-builder.json`: App id `com.claudecoderouter.desktop`, output `release/${version}`, protocol scheme `ccr`.
- `packages/core/src/config/default-config.ts`: Default gateway `127.0.0.1:3456`, core `127.0.0.1:3457`.
- `packages/core/src/config/constants.ts`: `config.sqlite`, `request-logs.sqlite`, `usage.sqlite`, `context-archive.sqlite`, certs, and spool directories.
- `packages/core/src/runtime/app-paths.ts`: Config directory is `~/.claude-code-router` on macOS and Linux, and `%APPDATA%/claude-code-router` on Windows. Non-Windows data lives in `<config>/app-data`.
- `packages/core/models.json`: Shipped model catalog. Refresh it with `npm run models:build` (`scripts/generate-models-json.mjs`).

**Core Logic:**

- `packages/core/src/gateway/application/gateway-service.ts`: Start, stop, reload, and external-gateway reuse.
- `packages/core/src/gateway/request/pipeline.ts`: One agent request from headers to upstream response.
- `packages/core/src/gateway/claude-code-router-plugin.ts`: Rule evaluation.
- `packages/core/src/config/config.ts`: Normalization and save API.
- `packages/core/src/profiles/service.ts`: Write agent config files.
- `packages/core/src/plugins/service.ts`: Plugin load and permission checks.
- `packages/ui/src/pages/home/App.tsx`: Screen state for the management UI.
- `packages/ui/src/pages/home/shared/`: Pure helpers the screen and tests share.

**Testing:**

- `packages/core/test/unit/`: Core unit tests, mirrored by area (`gateway/`, `routing/`, `providers/`, `agents/`).
- `packages/core/test/integration/`: Gateway wire and store tests.
- `packages/ui/test/unit/`, `packages/ui/test/component/`, `packages/ui/test/integration/`: UI tests.
- `packages/electron/test/unit/`: Desktop unit tests.
- `packages/cli/test/integration/`: CLI service tests.
- `tests/e2e/`: Playwright flows (`playwright.config.ts`).
- `tests/architecture/package-boundaries.test.mjs`: Workspace boundary checks.
- `packages/core/test/support/` and `packages/ui/test/fixtures/`: Shared test helpers. Put new fixtures next to the package that owns them.

## Naming Conventions

**Files:**

- Use `kebab-case.ts` for modules: `request-handler.ts`, `model-allowlist.ts`, `app-paths.ts`.
- Use `index.ts` only as the barrel for a preset or a UI folder (`providers/presets/openai/index.ts`, `pages/home/components/index.ts`).
- Name a React view file after the screen: `providers.tsx`, `routing.tsx`, `dashboard.tsx`.
- Name tests `*.test.ts`, `*.test.tsx`, or `*.test.mjs`. Core and CLI tests are `.mjs` that import the TypeScript source through the test runner. UI component tests are `.tsx`.

**Directories:**

- Name a core area with a singular noun that matches the service: `gateway`, `routing`, `providers`, `profiles`, `plugins`, `observability`.
- Name a provider preset directory with the preset id: `openrouter`, `zai-global-coding`, `zhipu-cn-general`.
- Name an agent directory with the agent id: `claude-code`, `claude-app`, `opencode`, `bot-gateway`.
- Put tests in `test/unit/<area>/` or `test/integration/<area>/` under the same package. Do not add tests under a top-level `tests/main` or `tests/renderer`; `tests/architecture/package-boundaries.test.mjs` forbids source files there.

**Symbols:**

- Export a class as `PascalCase` (`GatewayService`, `ConfigRepository`, `RoutePolicyEngine`, `ClaudeCodeRouterPlugin`).
- Export a function as `camelCase` (`loadAppConfig`, `compileRouterConfig`, `shouldApplyGatewayRouting`).
- Export a process singleton as a `camelCase` const: `gatewayService`, `pluginService`, `proxyService`, `mediaService`.
- Export a preset as `<name>ProviderPreset` and register it in `providerPresets`.
- Name IPC channels `ccr:<area>:<action>` in `IPC_CHANNELS` (`packages/core/src/contracts/ipc-channels.ts`).
- Import core as `@ccr/core/<dir>/<file>` and UI internals as `@/<path under packages/ui/src>`.

## Where to Add New Code

**New provider preset:**

- Implementation: `packages/core/src/providers/presets/<id>/index.ts` exporting a `ProviderPreset` from `packages/core/src/providers/presets/types.ts`.
- Registration: append it in `packages/core/src/providers/presets/index.ts`.
- Icon: `packages/ui/src/assets/provider-icons/` and the import map in `packages/ui/src/pages/home/shared/external.tsx` when the UI shows it.
- Tests: `packages/core/test/unit/providers/`.

**New agent profile:**

- Implementation: `packages/core/src/agents/<agent>/` for config write, launch, and model catalog.
- Wire-up: call it from `packages/core/src/profiles/service.ts` and `packages/core/src/profiles/launch-service.ts`.
- UI copy and form fields: `packages/ui/src/pages/home/shared/profiles.ts` and `packages/ui/src/pages/home/components/profiles.tsx`.
- Tests: `packages/core/test/unit/agents/` and, for a live config write, `packages/core/test/integration/agents/`.

**New gateway protocol transform:**

- Implementation: `packages/core/src/gateway/features/<name>.ts`.
- Call it from `packages/core/src/gateway/request/pipeline.ts` and, when the single runtime must see it, from `packages/core/src/gateway/core-runtime/router-plugin.ts`.
- Re-export a test helper from `packages/core/src/gateway/service.ts` only when existing tests import it from that path.
- Tests: `packages/core/test/unit/gateway/` or `packages/core/test/integration/gateway/`.

**New routing rule behavior:**

- Types: `packages/core/src/contracts/app.ts` and the normalizer in `packages/core/src/config/config.ts`.
- Compile and match: `packages/core/src/routing/config-compiler.ts`, `rewrite.ts`, and `packages/core/src/gateway/claude-code-router-plugin.ts`.
- UI editor: `packages/ui/src/pages/home/shared/routing.ts` and `packages/ui/src/pages/home/components/routing.tsx`.
- Tests: `packages/core/test/unit/routing/` and `packages/core/test/unit/gateway/routing-architecture.test.mjs`.

**New management API method:**

- Channel: `packages/core/src/contracts/ipc-channels.ts`.
- Desktop handler: `packages/electron/src/main/ipc.ts`.
- CLI and Docker handler: `rpcHandlers` in `packages/core/src/web/management-server.ts`.
- Bridges: `packages/electron/src/main/preload.ts` and `packages/ui/src/web-client-bridge.ts`.
- Types: `packages/ui/src/types/electron.d.ts` and the matching types in `packages/core/src/contracts/app.ts`.
- Call it from the UI as `window.ccr.<method>`. Do not call `fetch` to a new ad hoc path from React.

**New management screen:**

- View: `packages/ui/src/pages/home/components/<screen>.tsx`.
- Export: `packages/ui/src/pages/home/components/index.ts`.
- Drafts and formatters with no DOM: `packages/ui/src/pages/home/shared/<topic>.ts`.
- Screen state that must survive navigation: `packages/ui/src/pages/home/App.tsx`.
- Primitive control used by more than one screen: `packages/ui/src/components/ui/<control>.tsx`.
- Tests: `packages/ui/test/unit/` for shared helpers, `packages/ui/test/component/` for the view.

**New plugin:**

- User plugin: a directory the user selects; the host is `packages/core/src/plugins/service.ts`. Export `setup` or `activate` and optional `stop`.
- Plugin that ships with the desktop app: `packages/electron/bundled-plugins/<id>/`.
- Built-in transform with no install step: `packages/core/src/plugins/built-ins/`.
- Do not put plugin runtime code in `packages/ui`.

**New MCP tool server:**

- Server: `packages/core/src/mcp/<name>-mcp.ts`.
- Path and enablement: a sibling `*-config.ts` in the same directory.
- Register the route in `packages/core/src/gateway/http/request-handler.ts` or the router plugin, matching the existing MCP handlers.
- Keep the file free of `better-sqlite3`, Electron, and `packages/core/src/config/` imports so `build/esbuild.config.mjs` can emit the lightweight bundle.

**New desktop-only integration:**

- Implementation: `packages/electron/src/main/<feature>.ts`.
- Start it from `packages/electron/src/main/main-app.ts`.
- Expose it through the IPC path above. Return an explicit unsupported result from `rpcHandlers` when the CLI cannot do the same work.

**New CLI flag or command:**

- Implementation: `packages/cli/src/cli.ts` only. Put reusable behavior in core and call it from the CLI.
- Tests: `packages/cli/test/integration/`.

**Utilities:**

- Shared by core services: the area directory under `packages/core/src/`. Use `gateway/internal/` only for values already shared inside the gateway.
- Shared by UI screens: `packages/ui/src/pages/home/shared/`.
- Shared visual primitives: `packages/ui/src/components/ui/`.
- Repo scripts that are not product runtime: `scripts/` or `build/`.

**Do not add product code in these places:**

- `packages/core/src/gateway/service.ts` for behavior. Re-export only.
- `docs/`, `blog/`, or `cdn/` for runtime behavior.
- A new top-level package. The four workspaces are `cli`, `core`, `electron`, and `ui`.
- `packages/ui/src/generated/`. That JSON is produced by `scripts/generate-claude-code-config-options.mjs`.

## Special Directories

**`packages/*/dist/` and root `dist/`:**

- Purpose: esbuild output (`main/`, `renderer/`, bundled gateway, copied `models.json`).
- Generated: Yes
- Committed: No (`dist` is gitignored)

**`release/`:**

- Purpose: `electron-builder` artifacts (`electron-builder.json` `directories.output`).
- Generated: Yes
- Committed: No

**`packages/ui/src/generated/`:**

- Purpose: `claude-code-config-options.json` for the profile editor.
- Generated: Yes, by `scripts/generate-claude-code-config-options.mjs`
- Committed: Yes

**`packages/core/models.json`:**

- Purpose: Model catalog copied into each package `dist` at build time.
- Generated: Yes, by `scripts/generate-models-json.mjs`
- Committed: Yes

**`docker/local-ai-gateway/`:**

- Purpose: Optional local ai-gateway tarball consumed by `Dockerfile` and `npm run docker:prepare-gateway`.
- Generated: Yes, when the prepare script runs
- Committed: The directory exists; treat tarballs as build input, not source

**`packages/electron/bundled-plugins/`:**

- Purpose: Source for plugins packed into the desktop app and unpacked from the asar (`electron-builder.json` `asarUnpack`).
- Generated: No
- Committed: Yes

**`extension/chrome/`:**

- Purpose: Unpacked Chrome extension that imports selected-site cookies into the in-app browser (`extension/chrome/README.md`).
- Generated: No
- Committed: Yes

**`node_modules/`:**

- Purpose: Installed dependencies. Native `better-sqlite3` is rebuilt for Electron with `npm run rebuild:sqlite3`.
- Generated: Yes
- Committed: No

**`.planning/`:**

- Purpose: Planning documents for this repo's workflow.
- Generated: No
- Committed: Yes, when the planning workflow writes them

---

*Structure analysis: 2026-11-14*

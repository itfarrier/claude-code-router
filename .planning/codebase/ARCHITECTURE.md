---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
<!-- refreshed: 2026-11-14 -->
# Architecture

**Analysis Date:** 2026-11-14

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Coding agents and API clients                                            │
│ Claude Code, Codex, OpenCode, Kimi, Kilo, Pi, ZCode, WorkBuddy, custom  │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP (default http://127.0.0.1:3456)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Model gateway                                                            │
│ Single runtime: spawned `@the-next-ai/ai-gateway` + CCR router plugin    │
│   `packages/core/src/gateway/core-runtime/supervisor.ts`                 │
│   `packages/core/src/gateway/core-runtime/router-plugin.ts`              │
│ Compatibility runtime: CCR HTTP server proxies to core on port 3457     │
│   `packages/core/src/gateway/http/request-handler.ts`                    │
│   `packages/core/src/gateway/request/pipeline.ts`                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ provider HTTP (OpenAI / Anthropic / Gemini / …)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Upstream providers + local agent logins                                  │
│ `packages/core/src/providers/presets/`                                   │
│ `packages/core/src/agents/local-providers/`                              │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Management UI (same React app)                                           │
│ `packages/ui/src/pages/home/`  tray: `pages/tray/`  browser: `pages/browser/` │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ Electron `window.ccr` IPC        │ Browser POST /api/ccr/rpc
                ▼                                  ▼
┌──────────────────────────────┐    ┌──────────────────────────────────────┐
│ `packages/electron/src/main` │    │ `packages/core/src/web/management-server.ts` │
│ Desktop shell, tray, updates │    │ CLI (`packages/cli/src/cli.ts`) and Docker   │
└───────────────┬──────────────┘    └──────────────────┬───────────────────┘
                └──────────────────┬───────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ `@claude-code-router/core` domain services                               │
│ config, gateway, routing, profiles, plugins, proxy, mcp, usage, logs     │
│ `packages/core/src/`                                                     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ SQLite + files under the runtime config/data directories                │
│ `packages/core/src/config/constants.ts`                                  │
│ `packages/core/src/storage/sqlite-native.ts`                             │
└──────────────────────────────────────────────────────────────────────────┘
```

Claude Code Router is a local control plane. Coding agents keep one stable gateway URL. CCR chooses the provider, model, credential, and protocol behind that URL. The desktop app, the `ccr` CLI, and the Docker image all run the same core. They differ in how they host the management UI and which desktop-only integrations they include.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Electron bootstrap | Set runtime paths, load the native SQLite binding, then start the app | `packages/electron/src/main/main.ts` |
| Desktop lifecycle | Single-instance lock, start gateway and tray, restore agent configs on quit | `packages/electron/src/main/main-app.ts` |
| Desktop IPC | Map every `window.ccr` call to a core service | `packages/electron/src/main/ipc.ts` |
| Preload bridge | Expose `window.ccr` with `contextIsolation` and no Node in the renderer | `packages/electron/src/main/preload.ts` |
| Window host | Load the home, tray, browser, and plugin-app renderers | `packages/electron/src/main/windows.ts` |
| CLI | `ccr start`, `ccr ui`, `ccr stop`, `ccr web`, and profile launch | `packages/cli/src/cli.ts` |
| Core server | Foreground management server used by Docker and `ccr-core-server` | `packages/core/src/entrypoints/server.ts` |
| Management HTTP | Serve the UI and `POST /api/ccr/rpc` | `packages/core/src/web/management-server.ts` |
| Web client bridge | Implement `window.ccr` with that RPC endpoint | `packages/ui/src/web-client-bridge.ts` |
| Home UI | Providers, routing, profiles, logs, settings | `packages/ui/src/pages/home/App.tsx` |
| Gateway facade | Stable import surface for `gatewayService` and protocol helpers | `packages/core/src/gateway/service.ts` |
| Gateway owner | Start, stop, reload, and supervise the ai-gateway child | `packages/core/src/gateway/application/gateway-service.ts` |
| Public HTTP router | Auth, MCP, remote control, and proxy dispatch on the compatibility server | `packages/core/src/gateway/http/request-handler.ts` |
| Request pipeline | Normalize, route, transform, call upstream, record logs and usage | `packages/core/src/gateway/request/pipeline.ts` |
| Router plugin | Inject CCR routing into the spawned ai-gateway process | `packages/core/src/gateway/core-runtime/router-plugin.ts` |
| Route engine | Compile rules and pick a provider model | `packages/core/src/gateway/claude-code-router-plugin.ts` |
| Config | Normalize `AppConfig` and persist it | `packages/core/src/config/config.ts` |
| Config store | SQLite `app_config` plus API keys, with revision conflicts | `packages/core/src/config/config-repository.ts` |
| Profiles | Write agent client config and launch CLI or desktop agents | `packages/core/src/profiles/service.ts`, `packages/core/src/profiles/launch-service.ts` |
| Plugins | Load gateway plugins and built-in transforms | `packages/core/src/plugins/service.ts` |
| Proxy | Optional local HTTPS proxy and system-proxy integration | `packages/core/src/proxy/service.ts` |
| Request logs | SQLite request log plus a worker for writes and body reads | `packages/core/src/observability/request-log-store.ts`, `packages/core/src/observability/request-log-worker.ts` |
| Usage | Token and cost aggregates | `packages/core/src/usage/store.ts` |
| Contracts | Shared `AppConfig`, status, and IPC channel names | `packages/core/src/contracts/app.ts`, `packages/core/src/contracts/ipc-channels.ts` |

## Pattern Overview

**Overall:** Process-separated local gateway with one core and two management transports.

**Key Characteristics:**

- Put domain behavior in `packages/core/src`. Electron, the CLI, and Docker call that core. Do not copy service logic into a shell.
- Keep the renderer free of Node and SQLite. The renderer talks only through `window.ccr`.
- Give Electron and the browser the same `window.ccr` methods. Implement a new method in `packages/electron/src/main/ipc.ts` and in `rpcHandlers` inside `packages/core/src/web/management-server.ts`, then expose it from `packages/electron/src/main/preload.ts` and `packages/ui/src/web-client-bridge.ts`.
- Run model traffic in a child `@the-next-ai/ai-gateway` process. CCR compiles that process config in `packages/core/src/gateway/core-runtime/config-compiler.ts` and injects `packages/core/src/gateway/core-runtime/router-plugin.ts`.
- Use the compatibility HTTP server in `GatewayHttpRequestHandler` when a single public ai-gateway process cannot host the feature. `GatewayService.startGateway` logs that choice.
- Enforce package boundaries with TypeScript path aliases in `tsconfig.json` (`@ccr/core/*`, `@ccr/electron/*`, `@ccr/cli/*`, `@ccr/ui/*`, `@/*`). `packages/core/src` does not import Electron, the UI, or the CLI.

## Layers

**Product shells:**

- Purpose: Start the process, own OS integration, and present the UI.
- Location: `packages/electron/src/main/`, `packages/cli/src/cli.ts`, `Dockerfile`, `docker/`
- Contains: Electron windows, tray, auto-update, deep links, CLI daemon control, Nginx routing for Docker.
- Depends on: `@ccr/core/*`
- Used by: The user, `electron-builder` (`electron-builder.json`), and `npm run docker:compose:up`.

**Management transports:**

- Purpose: One UI API with two wires.
- Location: `packages/electron/src/main/ipc.ts`, `packages/electron/src/main/preload.ts`, `packages/core/src/web/management-server.ts`, `packages/ui/src/web-client-bridge.ts`
- Contains: `ipcMain.handle` registrations and the `rpcHandlers` map.
- Depends on: Core services and `IPC_CHANNELS` in `packages/core/src/contracts/ipc-channels.ts`.
- Used by: `packages/ui/src/pages/home/App.tsx` through `window.ccr`.

**Domain services:**

- Purpose: Config, providers, profiles, plugins, proxy, media, and usage.
- Location: `packages/core/src/`
- Contains: Module singletons such as `gatewayService`, `pluginService`, `proxyService`, `mediaService`, and `backendService`.
- Depends on: `better-sqlite3`, Node `http`, and the ai-gateway package.
- Used by: Both management transports and the gateway child.

**Request path:**

- Purpose: Accept an agent HTTP call, choose a route, call the provider, and record the outcome.
- Location: `packages/core/src/gateway/`, `packages/core/src/routing/`
- Contains: The HTTP handler, the pipeline, the router plugin, protocol transforms under `gateway/features/`, and the policy engine.
- Depends on: Compiled `AppConfig`, provider topology, and credential pools.
- Used by: External agents and the spawned ai-gateway process.

**Persistence:**

- Purpose: Store config, logs, usage, context archives, and proxy certificates.
- Location: `packages/core/src/storage/sqlite-native.ts`, `packages/core/src/config/config-repository.ts`, `packages/core/src/observability/`, `packages/core/src/usage/store.ts`
- Contains: `better-sqlite3` access and file paths from `packages/core/src/config/constants.ts`.
- Depends on: The runtime directories from `packages/core/src/runtime/app-paths.ts`.
- Used by: Config load/save and the request pipeline.

## Data Flow

### Primary Request Path

1. An agent sends HTTP to the public gateway. Defaults are `127.0.0.1:3456` for the public port and `127.0.0.1:3457` for the internal core port (`packages/core/src/config/default-config.ts`).
2. `GatewayService.startGateway` (`packages/core/src/gateway/application/gateway-service.ts`) loads plugins, starts media tools, and spawns the ai-gateway child with `spawnGatewayProcess` (`packages/core/src/gateway/core-runtime/supervisor.ts`). The child boots through `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`, which installs a virtual config file and then loads the ai-gateway entry.
3. On the single public runtime, `packages/core/src/gateway/core-runtime/router-plugin.ts` handles routing inside that child. On the compatibility runtime, the CCR HTTP server accepts the public port and `GatewayHttpRequestHandler.handleRequest` (`packages/core/src/gateway/http/request-handler.ts`) dispatches health, billing, trace sync, MCP, remote control, and model routes before proxying.
4. `GatewayRequestPipeline.proxyRequest` (`packages/core/src/gateway/request/pipeline.ts`) reads the body, strips untrusted `x-ccr-*` route headers, and applies protocol adaptation from `packages/core/src/routing/protocol-adapter.ts`.
5. When `shouldApplyGatewayRouting` (`packages/core/src/routing/protocol-endpoints.ts`) matches a POST to Anthropic Messages, OpenAI Chat, OpenAI Responses, or Gemini, the pipeline asks the core router plugin first and falls back to in-process `ClaudeCodeRouterPlugin.routeRequest`.
6. `ClaudeCodeRouterPlugin` compiles rules with `compileRouterConfig` (`packages/core/src/routing/config-compiler.ts`) and evaluates them in order through `RoutePolicyEngine` (`packages/core/src/routing/policy-engine.ts`). `createRouteExecutionPlan` (`packages/core/src/routing/execution-plan.ts`) turns the decision plus fallback config into attempts. `ModelRegistry` (`packages/core/src/routing/model-registry.ts`) resolves `Provider/model` selectors.
7. `fetchUpstreamWithFallback` (`packages/core/src/gateway/upstream/executor.ts`) performs the provider calls. Credential outcomes go to `packages/core/src/providers/credential-pool.ts`. Logs go to `recordGatewayRequestLog` and usage goes to `recordGatewayUsageCapture`.

```ts
// packages/core/src/routing/protocol-endpoints.ts
export function shouldApplyGatewayRouting(method: string, path: string): boolean {
  if (method.toUpperCase() !== "POST") {
    return false;
  }
  const protocol = requestProtocolForPath(path);
  if (protocol === "gemini_interactions") {
    return /\/v1(?:beta)?\/interactions$/i.test(path);
  }
  return Boolean(protocol);
}
```

```ts
// packages/core/src/routing/policy-engine.ts
export class RoutePolicyEngine<TContext, TDecision> {
  async evaluate(context: TContext): Promise<RoutePolicyMatch<TDecision> | undefined> {
    for (const policy of this.policies) {
      const decision = await policy.evaluate(context);
      if (decision) {
        return { decision, policyId: policy.id };
      }
    }
    return undefined;
  }
}
```

### Management UI Path

1. `packages/ui/src/pages/home/main.tsx` mounts `App`. The home screen calls `window.ccr.getConfig()`, `saveConfig`, `startGateway`, and the other methods declared in `packages/ui/src/types/electron.d.ts`.
2. In Electron, `packages/electron/src/main/windows.ts` loads `pages/home/index.html` with `packages/electron/src/main/preload.ts`. Preload `invoke` uses the channel constants in `packages/core/src/contracts/ipc-channels.ts`. Handlers in `packages/electron/src/main/ipc.ts` call `loadAppConfig`, `gatewayService`, `proxyService`, and the log and usage stores.
3. In the CLI and Docker, the management server injects `packages/ui/src/web-client-bridge.ts`. That bridge `POST`s `{ method, args }` to `/api/ccr/rpc`. `handleRpcRequest` (`packages/core/src/web/management-server.ts`) checks `x-ccr-web-auth` and dispatches `rpcHandlers`.
4. Saves go through `saveAppConfig` (`packages/core/src/config/config.ts`) into `ConfigRepository` (`packages/core/src/config/config-repository.ts`). A stale editor receives `AppConfigConflictError` (HTTP 409 on the web RPC).

```ts
// packages/ui/src/web-client-bridge.ts
async function rpc(method: string, args: unknown[] = []): Promise<unknown> {
  const response = await fetch(rpcEndpoint, {
    body: JSON.stringify({ args: trimTrailingUndefined(args), method }),
    headers: {
      "content-type": "application/json",
      ...(webAuthToken ? { [webAuthHeader]: webAuthToken } : {})
    },
    method: "POST"
  });
  // ...
}
```

### Profile Apply And Launch

1. The UI or `ccr <profile>` calls `applyProfile` / `openProfile`.
2. `applyProfileConfig` (`packages/core/src/profiles/service.ts`) writes the selected agent's config files and environment so the agent targets the CCR gateway.
3. `openProfileFromCcr` and `buildProfileLaunchPlan` (`packages/core/src/profiles/launch-service.ts`, `packages/core/src/profiles/launch-core.ts`) spawn the CLI or the desktop app. Claude Design stays desktop-only; `packages/cli/src/cli.ts` rejects that agent.
4. Agent-specific writers live under `packages/core/src/agents/<agent>/`, for example `packages/core/src/agents/opencode/profile-config.ts` and `packages/core/src/agents/claude-app/gateway-service.ts`.

### Plugin Registration

1. `pluginService.start(config)` (`packages/core/src/plugins/service.ts`) reads enabled plugins from `AppConfig`.
2. A plugin module exports `setup` or `activate`. The service passes a `GatewayPluginContext` and applies the returned `GatewayPluginRegistration` only when the plugin's surfaces and permissions allow it.
3. Built-in behavior that must ship without a user plugin lives in `packages/core/src/plugins/built-ins/`. Bundled desktop plugins live in `packages/electron/bundled-plugins/` (`claude-design`, `claude-ship`, `new-api-account`).

**State Management:**

- Keep process state in the module singletons `gatewayService`, `pluginService`, `proxyService`, `mediaService`, and `backendService`. Do not create a second gateway object.
- Keep durable user settings in `config.sqlite` (`APP_CONFIG_DB_FILE`). Keep request logs in `request-logs.sqlite`, usage in `usage.sqlite`, and context archives in `context-archive.sqlite` (`packages/core/src/config/constants.ts`).
- Keep React view state inside `packages/ui/src/pages/home/App.tsx` and the page components. Poll with `packages/ui/src/pages/home/shared/polling.ts`. There is no separate client store.

## Key Abstractions

**`AppConfig`:**

- Purpose: The one settings document for providers, router rules, profiles, gateway ports, proxy, plugins, API keys, and observability.
- Examples: `packages/core/src/contracts/app.ts`, `packages/core/src/config/default-config.ts`, `packages/core/src/config/config.ts`
- Pattern: Load with `loadAppConfig()`, normalize in `config.ts`, save with `saveAppConfig` / `saveApiKeysConfig`. Conflict checks use `appConfigRevision`.

**`ProviderPreset`:**

- Purpose: A built-in upstream endpoint, protocol list, and default models.
- Examples: `packages/core/src/providers/presets/types.ts`, `packages/core/src/providers/presets/index.ts`, `packages/core/src/providers/presets/openai/index.ts`
- Pattern: Add a directory under `presets/`, export a `ProviderPreset`, and append it to the `providerPresets` array. The UI reads presets through `getProviderPresets()`, not by importing gateway code.

**`ClaudeCodeRouterPlugin` and `RoutePolicyEngine`:**

- Purpose: Turn router rules into a provider/model decision.
- Examples: `packages/core/src/gateway/claude-code-router-plugin.ts`, `packages/core/src/routing/policy-engine.ts`, `packages/core/src/routing/rewrite.ts`, `packages/core/src/routing/model-registry.ts`
- Pattern: Add a policy or rewrite in `packages/core/src/routing/`, then call it from the plugin. Keep protocol body edits in `packages/core/src/gateway/features/` or `packages/core/src/routing/protocol-adapter.ts`.

**Gateway plugin module:**

- Purpose: User or bundled code that adds routes, transforms, apps, or provider-account connectors.
- Examples: `packages/core/src/plugins/service.ts`, `packages/electron/bundled-plugins/`
- Pattern: Export `setup(context)` or `activate(context)` and optional `stop`. Return registrations. Do not touch SQLite from a plugin unless the context gives a store.

**`window.ccr`:**

- Purpose: The only renderer API.
- Examples: `packages/ui/src/types/electron.d.ts`, `packages/electron/src/main/preload.ts`, `packages/ui/src/web-client-bridge.ts`, `packages/core/src/contracts/ipc-channels.ts`
- Pattern: Extend the channel list, both transports, both bridges, and the window type together.

**MCP tool servers:**

- Purpose: Stdio or HTTP tools for Fusion vision, media, web search, and ToolHub.
- Examples: `packages/core/src/mcp/toolhub-mcp.ts`, `packages/core/src/mcp/fusion-vision-mcp.ts`, `packages/core/src/mcp/media-tools-proxy-mcp.ts`
- Pattern: Keep these bundles small. `build/esbuild.config.mjs` rejects imports from `packages/core/src/config/`, `packages/core/src/storage/`, `packages/electron/src/`, `packages/ui/src/`, `better-sqlite3`, and `electron` inside lightweight MCP outputs.

## Entry Points

**Electron main:**

- Location: `packages/electron/src/main/main.ts`
- Triggers: `electron .` and the packaged app (`package.json` `"main": "packages/electron/dist/main/main.js"`).
- Responsibilities: Install the socket compatibility shim, mark the desktop runtime, point config paths at the shared data directory, then import `packages/electron/src/main/main-app.ts`.

**CLI:**

- Location: `packages/cli/src/cli.ts`
- Triggers: The `ccr` bin (`packages/cli/package.json`).
- Responsibilities: Refresh the model catalog, start or stop the background service, open the UI, and launch profiles. Service identity is stored as `service.json` under the config directory.

**Core server:**

- Location: `packages/core/src/entrypoints/server.ts`
- Triggers: The `ccr-core-server` bin and the Docker process manager.
- Responsibilities: Parse `--host`, `--port`, and `--no-gateway`, then call `startWebManagementServer`. Default management bind is `127.0.0.1:3458` unless `CCR_WEB_HOST` / `CCR_WEB_PORT` override it.

**Renderer pages:**

- Location: `packages/ui/src/pages/home/main.tsx`, `packages/ui/src/pages/tray/main.tsx`, `packages/ui/src/pages/browser/main.tsx`
- Triggers: Electron `loadURL` or the management server static files.
- Responsibilities: Mount the matching React tree. Home is the control plane. Tray is the status popover. Browser is the in-app browser shell.

**Gateway child:**

- Location: `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts`
- Triggers: `spawnGatewayProcess` after `GatewayService.start`.
- Responsibilities: Accept one `gateway:start` message, expose the compiled config through a virtual file, and load the ai-gateway entry. The child refuses writes to that managed config path.

**Router plugin:**

- Location: `packages/core/src/gateway/core-runtime/router-plugin.ts`
- Triggers: The ai-gateway process loads this bundle (esbuild entry `routerPluginInput` in `build/esbuild.config.mjs`).
- Responsibilities: Resolve routes, apply bridge transforms, and speak the plugin contract in `packages/core/src/gateway/core-runtime/router-plugin-contract.ts`.

**Docker:**

- Location: `Dockerfile`, `docker/README.md`, `docker-compose.yml`
- Triggers: `npm run docker:compose:up`
- Responsibilities: Nginx on container port `8080` (published as host `3458`) is the only public port. It serves the UI, proxies `/api/ccr/rpc` to the management server, and proxies gateway paths to `127.0.0.1:3456`. Docker does not include Electron, the tray, or desktop agent launch.

## Architectural Constraints

- **Threading:** Each process is a Node.js event loop. The ai-gateway runtime is a child process (`packages/core/src/gateway/core-runtime/supervisor.ts`). Request-log reads and writes use `worker_threads` (`packages/core/src/observability/request-log-worker.ts`). Route scripts run in a worker pool (`packages/core/src/routing/route-script-runtime.ts`, default 2 workers). MCP tool servers are separate stdio processes. Do not do blocking SQLite work on a lightweight MCP bundle.
- **Global state:** These module singletons own runtime state: `gatewayService` (`packages/core/src/gateway/application/gateway-service.ts`), `pluginService` (`packages/core/src/plugins/service.ts`), `backendService` (`packages/core/src/plugins/backend-service.ts`), `proxyService` (`packages/core/src/proxy/service.ts`), `mediaService` (`packages/core/src/media/service.ts`). `CONFIGDIR` and `DATADIR` are computed at import time in `packages/core/src/config/constants.ts`. Set `CCR_INTERNAL_HOME_DIR`, `CCR_INTERNAL_APP_DATA_DIR`, and `CCR_INTERNAL_USER_DATA_DIR` before that import. `packages/electron/src/main/main.ts` does this before it loads `main-app.ts`.
- **Circular imports:** Not detected as a checked cycle list. Keep the direction one way: shells import core; core does not import shells. `tests/architecture/package-boundaries.test.mjs` rejects a relative import of another package's `src` tree. New gateway code goes in a focused module under `packages/core/src/gateway/`; `packages/core/src/gateway/service.ts` only re-exports.
- **Loopback core:** `assertLoopbackCoreHost` in `packages/core/src/gateway/core-runtime/supervisor.ts` rejects a non-loopback `gateway.coreHost`.
- **Single desktop instance:** `packages/electron/src/main/main-app.ts` calls `app.requestSingleInstanceLock()` and quits when the lock is taken.
- **Renderer isolation:** Main windows set `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` (`packages/electron/src/main/windows.ts`).
- **Package manager layout:** npm workspaces are `packages/*` (`package.json`). `docs/` and `cdn/` are separate packages and are not workspace members.

## Anti-Patterns

### Cross-package relative source imports

**What happens:** A file under `packages/ui` or `packages/electron` imports `../../core/src/...` or a string path containing `packages/core/src`.
**Why it's wrong:** `tests/architecture/package-boundaries.test.mjs` fails the build contract, and the bundler entries in `build/esbuild.config.mjs` expect the `@ccr/*` aliases.
**Do this instead:** Import `@ccr/core/<area>/<file>`. From UI code, prefer `@ccr/core/contracts/app`, `@ccr/core/providers/presets`, and `@ccr/core/config/default-config`.

### New gateway behavior in the facade

**What happens:** Request handling or a protocol transform is added to `packages/core/src/gateway/service.ts`.
**Why it's wrong:** That file is the public re-export surface. Callers in Electron, the CLI, and tests import it so the path stays stable.
**Do this instead:** Add the behavior under `packages/core/src/gateway/application/`, `gateway/http/`, `gateway/request/`, `gateway/features/`, or `gateway/core-runtime/`, then re-export from `gateway/service.ts` only when an existing caller needs the symbol.

### SQLite or Electron inside a lightweight MCP bundle

**What happens:** `packages/core/src/mcp/fusion-vision-mcp.ts` or a sibling imports config, storage, or Electron.
**Why it's wrong:** `build/esbuild.config.mjs` rejects those imports. The MCP process must stay small and must not open the native database.
**Do this instead:** Pass the gateway base URL and auth header into the MCP process. Keep database access in `packages/core/src/observability/` and `packages/core/src/config/`.

### A management method on only one transport

**What happens:** A handler is added to `packages/electron/src/main/ipc.ts` and the desktop UI works, while `ccr ui` and Docker return an unknown RPC method.
**Why it's wrong:** The React app calls `window.ccr` in both hosts. `packages/ui/src/web-client-bridge.ts` and `rpcHandlers` are the non-Electron implementation of that same object.
**Do this instead:** Add the channel to `packages/core/src/contracts/ipc-channels.ts`, handle it in `ipc.ts` and `rpcHandlers`, and expose it from `preload.ts` and `web-client-bridge.ts`. Desktop-only behavior returns a clear unsupported result on the web path (the update handler already does this).

### Writing the spawned gateway config from inside the child

**What happens:** Code in the ai-gateway child writes `GATEWAY_CONFIG_PATH`.
**Why it's wrong:** `packages/core/src/gateway/core-runtime/gateway-bootstrap.ts` replaces `writeFileSync` and `renameSync` for that path and throws `Gateway configuration is managed by Claude Code Router.`
**Do this instead:** Change CCR config through `saveAppConfig` and let `GatewayService` recompile and reload the child.

## Error Handling

**Strategy:** Failures that belong to one request become HTTP JSON. Failures that belong to process startup become a status object or a process exit. Configuration conflicts are a typed error.

**Patterns:**

- Gateway HTTP responses use `sendJson` from `packages/core/src/gateway/http/io.ts`. An unconfigured gateway returns 503 `{ error: { message } }` from `GatewayHttpRequestHandler`. Auth failures stop in `packages/core/src/gateway/auth/api-key-authorizer.ts` before the pipeline proxies.
- `GatewayService.startGateway` catches startup failures, stops partial resources, and returns `GatewayStatus` with `state: "error"` and `lastError`. Callers such as the UI read that status. They do not need a thrown start error.
- Upstream failures that exhaust fallbacks are rewritten for clients that only show `error.message` in `packages/core/src/gateway/http/error-detail.ts`.
- `AppConfigConflictError` (`packages/core/src/config/config-repository.ts`) means the saved revision changed. The web RPC maps that error name to HTTP 409 (`packages/core/src/web/management-server.ts`).
- Electron startup failures before `main-app.ts` loads call `dialog.showErrorBox` and `app.exit(1)` (`packages/electron/src/main/main.ts`). IPC failures are rethrown as localized `Error`s in `packages/electron/src/main/preload.ts` via `packages/core/src/contracts/i18n.ts`.
- Throw `new Error("...")` with a sentence the UI can show. Do not swallow a failed config write.

## Cross-Cutting Concerns

**Logging:** Use `console.info`, `console.warn`, and `console.error` with a bracket prefix such as `[gateway]` or `[web]`. Per-request history goes through `packages/core/src/observability/request-log-store.ts` into the request-log worker. Route decisions for the log UI go through `packages/core/src/observability/route-trace.ts`. There is no third-party logger.

**Validation:** Normalize every loaded config in `packages/core/src/config/config.ts` before the rest of the process sees it. Compile router rules in `packages/core/src/routing/config-compiler.ts` and drop invalid models instead of sending them upstream. Check provider API-key shape with `providerApiKeySafetyIssue` in `packages/core/src/providers/presets/index.ts`. Check profile model allowlists with `packages/core/src/profiles/model-allowlist.ts` before a request is forwarded.

**Authentication:** The management UI and RPC use `CCR_WEB_AUTH_TOKEN` or a generated token, sent as `x-ccr-web-auth` or the `ccr_web_token` query (`packages/core/src/web/management-server.ts`). Gateway clients use CCR API keys through `authorize` in `packages/core/src/gateway/auth/api-key-authorizer.ts`. The public gateway key and the management token are different credentials. The spawned core process uses a generated token from `generateCoreGatewayAuthToken` and accepts it only from the parent. Provider secrets stay in the config database.

---

*Architecture analysis: 2026-11-14*

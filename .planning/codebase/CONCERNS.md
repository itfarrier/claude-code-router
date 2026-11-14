---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# Codebase Concerns

**Analysis Date:** 2026-11-14

## Tech Debt

**Plaintext credential storage behind an encryption column:**
- Issue: Gateway API keys are written to `api_keys.encrypted_key` with `encryption` set to `plain`. The reader accepts only that value. Provider credentials stay inside the `app_config.value_json` blob. The column name describes encryption the code does not perform.
- Files: `packages/core/src/config/config-repository.ts`, `packages/core/src/config/constants.ts` (`APP_CONFIG_DB_FILE` is `config.sqlite`)
- Impact: Anyone who can read the config database gets gateway keys and provider credentials. A future non-`plain` value is skipped with a warning, so those keys vanish from authorization until they are saved again.
- Fix approach: Encrypt the key column and the provider-credential fields with a local keychain key, or rename the column and document plaintext as the storage contract. Keep the SQLite file mode at `0o600`.

**Gateway and provider secrets copied into client config files and backups:**
- Issue: Profile apply writes the gateway bearer token into client config (`experimental_bearer_token` for Codex, `api_key` for Kimi). ToolHub runtime env, including `TOOLHUB_MCP_SERVERS_JSON` and `TOOLHUB_OPENAI_API_KEY`, is written into the Codex MCP table. Each change also copies the previous file to `<file>.ccr-backup-<timestamp>`.
- Files: `packages/core/src/profiles/service.ts` (`buildCodexConfigToml`, `buildCodexToolHubMcpBlock`, `buildKimiProfileConfigToml`, `writeFileWithBackup`, `backupFilePath`), `packages/core/src/mcp/toolhub-config.ts`
- Impact: `~/.codex/config.toml`, `~/.claude/settings.json`, and their `.ccr-backup-*` siblings become extra copies of gateway and upstream API keys. Bin-dir backup cleanup does not remove those client-config backups. `chmodFileIfRequested` skips mode enforcement on Windows.
- Fix approach: Keep client files on a file reference or OS keychain entry. Delete or redact `.ccr-backup-*` copies that contain bearer tokens. Apply an ACL on Windows instead of returning before `chmod`.

**Two gateway runtimes selected by a blocker list:**
- Issue: `shouldUseSingleGatewayRuntime` is false when any of these are active: proxy, network capture, context archive, media tools, browser-automation MCP, plugin gateway routes, non-built-in request transforms, API-key limits, or router fallback. The process then listens with the compatibility server and spawns a core child.
- Files: `packages/core/src/gateway/application/gateway-service.ts` (`singleGatewayRuntimeBlockers`, `unifiedServerFallbackFeatureBlockers`)
- Impact: Enabling a normal feature changes process layout, ports (`gateway.port` vs `gateway.corePort`), and which code path handles auth and streaming. Fixes land in one runtime and miss the other.
- Fix approach: Move proxy, limits, context archive, and browser automation onto the single runtime, and delete the compatibility server once those blockers are gone.

**God modules:**
- Issue: Routing, profiles, config parsing, request logs, and the main UI pages are single files of several thousand lines. A vendored plugin bundle sits in-tree.
- Files: `packages/core/src/agents/codex/cli-middleware-runtime.ts` (7437 lines), `packages/core/src/observability/request-log-store.ts` (6583), `packages/ui/src/pages/home/components/dashboard.tsx` (6497), `packages/ui/src/pages/home/components/providers.tsx` (5114), `packages/core/src/config/config.ts` (4287), `packages/core/src/profiles/service.ts` (4284), `packages/ui/src/pages/home/App.tsx` (3641), `packages/electron/src/main/browser-automation-mcp.ts` (3544), `packages/ui/src/pages/home/components/settings.tsx` (3455), `packages/core/src/mcp/toolhub-mcp.ts` (2936), `packages/electron/bundled-plugins/claude-design/index.cjs` (16732)
- Impact: A one-line behavior change in profiles or the Codex middleware can break another agent, and review cannot see the whole behavior. The Claude Design bundle cannot be patched safely by hand.
- Fix approach: Split along existing seams (one agent profile writer, one request-log table module, one UI page section) only when the next change touches that file. Replace the Claude Design bundle by rebuilding it from its source, and keep the bundle generated.

**Unused process manager and two lockfiles:**
- Issue: `pm2` is a direct dependency of the root package and `@claude-code-router/core`, and source never imports it. `package-lock.json` and `pnpm-lock.yaml` are both present. Scripts use npm (`package.json` `workspaces` and `npm run`).
- Files: `package.json`, `packages/core/package.json`, `package-lock.json`, `pnpm-lock.yaml`
- Impact: Installs can follow different trees. `pm2` pulls a large transitive set that `package.json` `overrides` already special-cases (`pm2.js-yaml`).
- Fix approach: Remove `pm2` from both package manifests. Keep one lockfile that matches the npm scripts.

**Duplicated UI strings:**
- Issue: User-facing copy lives in the core contract catalog and again in the home-page i18n map.
- Files: `packages/core/src/contracts/i18n.ts`, `packages/ui/src/pages/home/shared/i18n.tsx` (2569 lines)
- Impact: A string change in one file ships in the other language or the other package with the old wording.
- Fix approach: Generate the UI map from `packages/core/src/contracts/i18n.ts`, or load that module from the renderer.

## Known Bugs

**Route-script timeout leaves the script running:**
- Symptoms: A script that exceeds `timeoutMs` returns a timeout error to the router, then its `fetch` and filesystem calls continue. The worker accepts the next script while the timed-out script is still in progress.
- Files: `packages/core/src/routing/route-script-worker.ts` (`withDeadline`, `evaluateRequest`, the serial `queue`)
- Trigger: A route script of type `script` awaits past `script.timeoutMs`. `vm` `timeout` covers only the synchronous `runInContext` slice. `withDeadline` rejects the promise and does not abort the script.
- Workaround: Keep route scripts synchronous and short. There is no cancellation token on the bridge.

**Persisted API keys fail closed on a transient database error:**
- Symptoms: A valid persisted gateway key receives `401` while the database read is failing. The warning is `[gateway] Failed to load persisted API keys`.
- Files: `packages/core/src/gateway/auth/api-key-authorizer.ts` (`loadPersistedApiKeysCached`), `packages/core/src/config/config-repository.ts`
- Trigger: `loadPersistedApiKeys()` throws after the 1-second cache expires. The catch returns `[]` and does not keep the previous cache. `authorize` then refreshes and hits the same failure.
- Workaround: Keys still present on `config.APIKEY` / `config.APIKEYS` continue to work. Restart after the database is readable again.

## Security Considerations

**Web management token is placed in the URL, and the RPC surface is full admin:**
- Risk: `startWebManagementServer` puts the auth token in the `ccr_web_token` query parameter and passes that URL to the OS opener. A failed open logs the URL. RPC then allows config read/write, data export, proxy CA install, gateway restart, and `quitApp`. Static pages do not require the token. RPC checks only the `x-ccr-web-auth` header.
- Files: `packages/core/src/web/management-server.ts` (`urlWithWebAuthToken`, `hasValidWebAuthToken`, `rpcHandlers`, `openSystemExternal`)
- Current mitigation: The token is 32 random bytes unless `CCR_WEB_AUTH_TOKEN` is set. Default bind is `127.0.0.1`. Host allow-listing rejects unexpected `Host` values. Comparison uses `timingSafeEqual`.
- Recommendations: Deliver the token through a loopback header or a one-time localhost exchange, and stop putting it in the query string and in logs. Treat a `CCR_WEB_HOST` of `0.0.0.0` or `::` as remote-admin mode: `allowIpLiteralHosts` then accepts any IP `Host`.

**Loopback CORS on the management server:**
- Risk: Any `http` origin whose host is loopback, on any port, receives `Access-Control-Allow-Origin`. `CCR_WEB_ALLOWED_ORIGINS` adds exact extra origins.
- Files: `packages/core/src/web/management-server.ts` (`allowedWebCorsOrigin`, `applyWebCorsHeaders`)
- Current mitigation: Cross-origin calls still need `x-ccr-web-auth`. The browser same-origin policy hides the query token from other loopback pages.
- Recommendations: Allow only the management origin plus an explicit list. Drop the any-port loopback exception after the docs wizard can send the header.

**Gateway API key accepted from the remote-control query string:**
- Risk: `/__ccr/remote` accepts `api_key` or `key` in the query string. That value is the same bearer token used for the rest of the gateway, including runtime config control when it is the primary key.
- Files: `packages/core/src/gateway/http/io.ts` (`readRemoteControlQueryAuthToken`), `packages/core/src/gateway/auth/api-key-authorizer.ts`, `packages/core/src/gateway/core-runtime/router-plugin.ts` (`handleRemoteControlRoute`, `handleRuntimeConfigControlRoute`)
- Current mitigation: The query token is read only for the remote-control path. Header auth remains the normal path.
- Recommendations: Require the `Authorization` header for remote control. Redact `api_key` and `key` before any access log.

**Claude Code WIF returns the long-lived API key:**
- Risk: `POST /v1/oauth/token` checks the JWT-bearer assertion by comparing it to a configured API key, then returns that same key as `access_token` with `expires_in` of 3600. The route is registered with `auth: "none"`. The token does not expire in 3600 seconds.
- Files: `packages/core/src/gateway/auth/api-key-authorizer.ts` (`exchangeClaudeCodeWifToken`), `packages/core/src/gateway/core-runtime/router-plugin.ts` (`ccr-public-wif-token`)
- Current mitigation: A wrong assertion returns `invalid_grant`. Per-key compare uses `timingSafeEqual` after a length check.
- Recommendations: Issue a random short-lived token stored server-side, and stop echoing the permanent key. Align `expires_in` with the real lifetime.

**Route scripts and custom routers run operator code with broad host access:**
- Risk: A `script` rule runs in `vm` with `codeGeneration` disabled, then the bridge exposes every `process.env` entry, HTTP(S) `fetch`, and read/write of any filesystem path (`path.resolve`, including `~`). `CUSTOM_ROUTER_PATH` and plugin modules are loaded with `require` / dynamic `import` in the gateway process. Absolute paths are allowed. Relative paths must stay under the config directory. The custom router receives the full config object.
- Files: `packages/core/src/routing/route-script-worker.ts` (`routeScriptEnvironment`, `resolveScriptPath`, `controlledFetch`), `packages/core/src/gateway/claude-code-router-plugin.ts` (`resolveCustomRoute`), `packages/core/src/plugins/service.ts` (`loadPluginModule`, `resolveLocalModulePath`)
- Current mitigation: Package specifiers and URL imports are rejected. Plugin permissions gate some registrations. The script result is size-capped. Fetch rejects non-HTTP URLs and embedded credentials.
- Recommendations: Default the bridge to a configured directory and an env allow-list. Block link-local and metadata hosts. Load `CUSTOM_ROUTER_PATH` in the same worker, and pass a config view that omits credentials. Treat config import and deep links that set a router or plugin path as code install.

**Local MITM certificate authority:**
- Risk: Enabling the proxy creates a 2048-bit RSA CA with `node-forge`, valid for 20 years, and can install it into the system trust store. The private key is `key.pem` under the data certs directory. Web RPC `installProxyCertificate` performs that install for a caller who has the web token.
- Files: `packages/core/src/proxy/certificates.ts`, `packages/core/src/proxy/service.ts`, `packages/core/src/config/constants.ts` (`PROXY_CA_KEY_FILE`), `packages/core/src/web/management-server.ts`
- Current mitigation: The proxy is off by default (`packages/core/src/config/default-config.ts`). The key file mode is `0o600` and the cert directory mode is `0o700`. Saving a config with `proxy.enabled` requires the certificate to already be trusted.
- Recommendations: Shorten CA lifetime, prefer Node `crypto` over `node-forge` for generation, and require a second confirmation in the UI before system-trust install. Document that a copied `key.pem` can intercept TLS for the machine until the CA is removed.

**Chrome login import is a capability URL with wildcard CORS:**
- Risk: The desktop app opens an unauthenticated HTTP server on `127.0.0.1` with a random port. Knowing `/chrome-import/jobs/<uuid>` allows `POST .../cookies`, which writes cookies and `localStorage` into the built-in browser partitions. CORS is `access-control-allow-origin: *`. The confirm page embeds the job id and import URL. `script-src` is `'none'`.
- Files: `packages/electron/src/main/chrome-login-import.ts` (`ensureServer`, `handleRequest`, `setCorsHeaders`, `writeLocalStorage`)
- Current mitigation: The job id is a UUID, the TTL is 5 minutes, cookies must match the job domains, and `localStorage` writes abort when the origin redirects.
- Recommendations: Require a second secret header that is not in the HTML. Reflect only the extension origin. Reject cookie injection after the confirm page has been shown to a different client.

**Browser automation is an API-key-gated desktop control plane:**
- Risk: With ToolHub browser automation enabled, `POST /__ccr/browser-automation/mcp` can drive the built-in browser (navigation, input, snapshots). The gateway API key is copied into the ToolHub MCP server entry and into the Codex env block.
- Files: `packages/core/src/gateway/http/request-handler.ts`, `packages/electron/src/main/browser-automation-mcp.ts`, `packages/core/src/mcp/toolhub-config.ts`
- Current mitigation: The route calls `authorize` before the Electron handler. The feature is off unless `toolHub.enabled` and `toolHub.browserAutomation` are set. The compatibility runtime is required for this feature.
- Recommendations: Use a separate automation credential with a short TTL. Keep that credential out of `TOOLHUB_MCP_SERVERS_JSON` in `~/.codex/config.toml`.

**Inconsistent token comparison:**
- Risk: Some bearer checks use `timingSafeEqual`. The raw-trace sync header and the service-instance token use ordinary string equality.
- Files: `packages/core/src/gateway/core-runtime/router-plugin.ts` (`readRawTraceSyncToken` check in the raw-trace route), `packages/core/src/web/management-server.ts` (`getServiceIdentity`)
- Current mitigation: Those tokens are random when the process generates them, and the endpoints are local by default.
- Recommendations: Compare every auth token with the existing `constantTimeEqual` helper.

**API-key limits trust a character-count estimate:**
- Risk: Token limits use `ceil(characters / 4)` plus `max_tokens`, defaulting output to 1024 when the field is absent. The counters live in a process-local `Map` and reset on gateway restart. They also force the compatibility runtime.
- Files: `packages/core/src/gateway/limits/window-limiter.ts`, `packages/core/src/gateway/auth/api-key-authorizer.ts` (`reserveApiKeyLimits`), `packages/core/src/gateway/application/gateway-service.ts`
- Current mitigation: The check-and-increment in one process is synchronous, so one process does not lose updates to interleaving. Request-count limits do not depend on the estimate.
- Recommendations: Count tokens with the same estimator the router uses, and persist counters in the gateway process that actually serves traffic.

**Provider deep links carry secrets in the URL:**
- Risk: `ccr://provider` links may include an API key up to 8192 characters. The raw URL is stored on the pending request and broadcast to the renderer. `ccr://plugin/<id>/open` starts the gateway and opens a configured plugin window without the provider-link confirmation dialog.
- Files: `packages/core/src/contracts/deep-link.ts`, `packages/electron/src/main/deep-link.ts`, `packages/ui/src/pages/home/shared/providers.ts`
- Current mitigation: Provider links wait in the UI dialog. Plugin links only open a plugin id already present in config. Link length is capped at 32000 characters.
- Recommendations: Strip the key from `rawUrl` after parse. Confirm plugin opens in the UI the same way provider links are confirmed.

**Request logs store bodies when logging is turned on:**
- Risk: Header redaction covers authorization-like names. JSON bodies are stored as captured text. Defaults when an operator enables logs are body capture `all`, success sample rate `1`, and a 50 MiB body cap. Raw trace mode becomes `wire_raw`.
- Files: `packages/core/src/observability/sensitive-headers.ts`, `packages/core/src/observability/request-log-limits.ts`, `packages/core/src/observability/raw-trace-sync.ts` (`buildRawTraceConfig`), `packages/core/src/config/default-config.ts` (`observability`)
- Current mitigation: `requestLogs` and `agentAnalysis` default to false. Bodies go to sidecar files under `request-log-bodies` rather than inline SQLite cells. Route traces can suppress body values.
- Recommendations: Default capture to `errors`. Redact JSON fields whose names match the header pattern before writing `packages/core/src/observability/request-log-store.ts` body files.

## Performance Bottlenecks

**Request-log writer under full body capture:**
- Problem: A enabled log stream samples every success and can queue bodies up to 50 MiB. The runtime posts batches to a worker (default batch 4 MiB or 50 items, 10 ms wait). The worker runs synchronous `better-sqlite3` with `busy_timeout` 5000.
- Files: `packages/core/src/observability/request-log-runtime.ts`, `packages/core/src/observability/request-log-store.ts`, `packages/core/src/observability/request-log-limits.ts`
- Cause: `defaultRequestLogBodyBytes` equals `rawTraceHardMaxBodyBytes` (50 MiB). `synchronous = NORMAL` and `journal_mode = WAL` keep the writer correct, and a large body still has to be copied into the worker and onto disk.
- Improvement path: Default the cap to a few hundred KiB, keep the 50 MiB value as an explicit opt-in, and spill bodies to files before `postMessage`.

**Admission state is dropped when the in-memory queue is full:**
- Problem: Past 20,000 pending admission operations, the oldest operation is settled without running. A warning says the oldest fail-closed state was released.
- Files: `packages/core/src/observability/request-log-runtime.ts` (`submitAdmissionOperation`, `defaultAdmissionMaxPendingOperations`)
- Cause: The admission map is an in-process bound, not a durable queue.
- Improvement path: Stop accepting new log records when the bound is hit, and surface that in gateway status. Keep the operations that mark a record committed.

**Route-script worker is one serial queue:**
- Problem: Every script rule on the process shares one worker queue. A slow script blocks the next script until `withDeadline` fires, and the timed-out work can still occupy the host.
- Files: `packages/core/src/routing/route-script-worker.ts`, `packages/core/src/routing/route-script-runtime.ts`
- Cause: `queue` chains `evaluateRequest` calls. Fetch and filesystem calls run on that same thread.
- Improvement path: One worker per in-flight script with a hard process timeout that kills the worker.

**Custom router is reloaded on every request:**
- Problem: `resolveCustomRoute` deletes `require` cache and loads `CUSTOM_ROUTER_PATH` for each routed request.
- Files: `packages/core/src/gateway/claude-code-router-plugin.ts`
- Cause: Cache deletion is how config edits are picked up without a restart.
- Improvement path: Cache the loaded function and reload only when the file mtime or config revision changes.

**Long upstream timeouts:**
- Problem: The default gateway timeout is 600000 ms. Bot turns, media jobs, and browser-automation handoff use the same 10-minute scale. Context archive allows 512 MiB of history and 32 MiB snapshots.
- Files: `packages/core/src/config/default-config.ts` (`API_TIMEOUT_MS`, `botGateway`, `mediaTools`, `contextArchive`), `packages/core/src/mcp/toolhub-config.ts` (`BROWSER_AUTOMATION_HANDOFF_TIMEOUT_MS`)
- Cause: Agent streams are expected to stay open. Each open stream holds a socket and a pipeline of Node streams.
- Improvement path: Keep the long timeout for streaming generations, and use a separate idle timeout for silent sockets. Cap concurrent streams per API key.

## Fragile Areas

**Streaming response pipeline can kill the process:**
- Files: `packages/core/src/gateway/request/pipeline.ts`, `packages/core/src/gateway/core-runtime/router-plugin.ts`, `packages/core/src/gateway/features/codex-patch-bridge.ts`, `packages/core/src/gateway/features/codex-multi-agent-bridge.ts`, `packages/electron/src/main/main.ts`
- Why fragile: An upstream reset on a `Readable.fromWeb()` source emits `error`. `.pipe()` does not forward that error. The router plugin comment states that an unhandled `error` kills the core process. `pipeline.ts` lists every stage in `responseStreams` and attaches `onResponseStreamError` by hand. Electron removes its startup `uncaughtException` listener after `main-app.js` loads.
- Safe modification: Add every new stream stage to `uniqueStreams` before `pipe`. Prefer `stream.pipeline`. Extend `packages/core/test/unit/gateway/stream-upstream-reset.test.mjs` for the new stage.
- Test coverage: The unit test covers the apply-patch bridge, the multi-agent bridge, and the live token-rate hook. A new stage between those hooks is untested until it is added there.

**Profile apply writes into user home directories:**
- Files: `packages/core/src/profiles/service.ts`, `packages/core/src/agents/codex/cli-middleware-runtime.ts`, `packages/core/src/agents/kilo/profile-config.ts`, `packages/core/src/agents/opencode/profile-config.ts`
- Why fragile: One function rewrites Claude, Codex, Kimi, OpenCode, Pi, and Zcode settings, installs wrapper scripts, and restores backups. The Codex CLI middleware is a 7437-line script template spawned with the user environment (`env: process.env` in the generated launcher).
- Safe modification: Change one agent writer and run `packages/core/test/integration/profiles/profile-service.test.mjs` plus `packages/core/test/integration/agents/codex-cli-middleware-runtime.test.mjs`. Preserve `writeFileWithBackup` and the managed-marker strippers.
- Test coverage: Profile integration coverage is large. The middleware test evaluates selected functions with `Function(...)`. Most of the generated script has no direct branch test.

**Config parse and revision hashing:**
- Files: `packages/core/src/config/config.ts`, `packages/core/src/config/config-repository.ts` (`appConfigRevision`, `AppConfigConflictError`)
- Why fragile: The parser accepts legacy and current shapes in one 4287-line module. Revision hashing omits `theme`, `configRevision`, `APIKEY`, and `APIKEYS`. A new secret field inside the remaining object changes the revision; a field added to the omitted set will not.
- Safe modification: Add the field to the parser and to `appConfigRevision` in the same change. Expect `409` when two writers race.
- Test coverage: `packages/core/test/unit/config/` covers migration, concurrency, and backup deduplication. The long parser still has combinations that those files do not name.

**Plugin rollback:**
- Files: `packages/core/src/plugins/service.ts` (`rollbackConfiguredPluginLoad`)
- Why fragile: A failed plugin setup restores in-memory arrays and runs new stop hooks. A stop hook that throws is logged and skipped. Routes registered before the failure must not remain reachable.
- Safe modification: Register routes only after setup resolves, which the snapshot/rollback path already attempts. Add a case to `packages/core/test/integration/plugins/plugin-service.test.mjs` when adding a new registration list.
- Test coverage: Plugin service integration tests exist. Each new array on the snapshot needs an explicit rollback assertion.

## Scaling Limits

**One gateway process plus an optional core child:**
- Current capacity: A single Node process serves the public port. Features on the blocker list add a child core process. Route scripts are one worker. Request logs use one writer worker and one query worker.
- Limit: CPU-heavy routing, synchronous SQLite in the log worker, and 10-minute streams do not fan out across machines. `busy_timeout` of 5000 ms stalls the log writer while another connection holds the database.
- Scaling path: Keep one local gateway, move log writes to append-only files, and cap concurrent streams. Horizontal replicas are out of scope until API-key counters and SQLite leave process memory.

**API-key windows are per process and in memory:**
- Current capacity: Counters live in `apiKeyLimitCounters` in `packages/core/src/gateway/limits/window-limiter.ts`. Retention is two windows. Every read scans the map for expiry.
- Limit: A restart clears limits. Two processes would each allow a full quota. A large map makes every request scan stale keys.
- Scaling path: Store counters in one SQLite row per window, and prune with a `DELETE` by `expires_at` instead of a full Map scan.

**Context archive and log disks:**
- Current capacity: Context archive defaults are 512 MiB total, 32 MiB per snapshot, 200 snapshots, 30 days. Request log bodies default to the 50 MiB hard cap per body when logging is on. Raw trace spool is `raw-trace-spool` under the data directory.
- Limit: A busy coding session with body capture fills the data directory. The UI then reads those bodies back through `getRequestLogBodyChunk`.
- Scaling path: Retention jobs should delete sidecar files and spool parts together with the SQLite rows. Default capture stays on errors only.

**Browser automation and media tools are desktop-local:**
- Current capacity: Browser automation returns 503 outside Electron. Media tools default to 2 image jobs and 1 video job, each with a 600000 ms timeout. Input roots are the working directory (when it is not the home directory or the filesystem root), the temp directory, the config directory, and `mediaTools.allowedInputRoots`.
- Limit: These features cannot run in the Docker/CLI-only gateway. They also disable the single runtime.
- Scaling path: Keep them local. Document the blocker so operators expect the compatibility process layout.

## Dependencies at Risk

**`pm2` ^7.0.3:**
- Risk: Declared by the root package and `@claude-code-router/core`, with no source import. The tree includes `@pm2/blessed`, `@pm2/js-api`, and `pm2-deploy`. An override forces `js-yaml` 4.3.1 under `pm2`.
- Impact: Extra install time and a larger vulnerability surface on every release.
- Migration plan: Delete the dependency and the `pm2` override block from `package.json`.

**`node-forge` ^1.4.0:**
- Risk: The MITM CA and certificate signing go through a pure-JavaScript ASN.1 library (`packages/core/src/proxy/certificates.ts`). Historical `node-forge` issues have been parser bugs.
- Impact: A forge bug in certificate generation or parsing affects every machine that trusts the CCR CA.
- Migration plan: Generate the CA and leaf certificates with `node:crypto`. Keep forge only if a caller still needs a forge object, then remove it.

**`better-sqlite3` ^12.11.1:**
- Risk: Native addon used by config, usage, and request logs. Electron needs `npm run rebuild:sqlite3` (`electron-rebuild -f -w better-sqlite3` in `package.json`).
- Impact: A Node or Electron bump without a rebuild fails at startup when opening `config.sqlite` or `request-logs.sqlite`.
- Migration plan: Keep the rebuild script in the Electron pack path. Pin the addon to the Electron ABI in CI by running the core test suite inside the packaged runtime.

**`@the-next-ai/ai-gateway` ^1.0.21:**
- Risk: The core HTTP gateway is this package. CCR compiles a config and loads `packages/core/src/gateway/core-runtime/router-plugin.ts` into it. The version range is caret.
- Impact: A minor release can change plugin hooks, streaming, or auth order and break routing without a CCR code change.
- Migration plan: Pin the exact version tested in CI. Upgrade in a dedicated change that runs `packages/core/test/integration/gateway/`.

**Security overrides that must stay until the tree moves:**
- Risk: `package.json` `overrides` force `fast-uri` 3.1.2 to 3.1.5, `find-my-way` 9.6.0 to 9.7.0, `brace-expansion` 5.0.9 under `minimatch` 10.2.5, and `ip-address` 10.5.0 under `socks`.
- Impact: Removing an override puts the previous vulnerable transitive version back.
- Migration plan: Re-check `npm ls` before deleting an override. Delete the override only when the parent package no longer depends on the vulnerable version.

**Two lockfiles:**
- Risk: `package-lock.json` and `pnpm-lock.yaml` can diverge. `docs/package-lock.json` is a third tree.
- Impact: A developer using pnpm installs a different set than CI using npm.
- Migration plan: Generate installs from `package-lock.json` only, and remove `pnpm-lock.yaml` in the same change. Keep `docs/package-lock.json` only if the docs site is published on its own.

## Missing Critical Features

**At-rest encryption for secrets:**
- Problem: The `encryption` column exists and the only implemented value is `plain`. Provider credentials in `app_config.value_json` have no separate protection.
- Blocks: A stolen laptop disk or a backed-up config directory exposes gateway keys, provider keys, and, when logging is on, request bodies.

**Body redaction for stored JSON:**
- Problem: Header redaction does not walk request and response JSON. Bodies are stored when capture is `all`.
- Blocks: Safe sharing of `request-logs.sqlite` and `request-log-bodies` with support or between machines.

**Lint gate:**
- Problem: The repository has no ESLint, Prettier, or Biome config. `npm test` runs package tests and architecture tests. Typecheck is a separate script (`npm run typecheck`) and is not part of `npm test`.
- Blocks: A formatting or unused-code failure is invisible until review or a typecheck run.

## Test Coverage Gaps

**Electron browser control plane:**
- What's not tested: The Chrome login-import HTTP server, CORS, cookie domain checks, and the 3544-line browser-automation MCP tool handlers have no test file under `packages/electron/test/`.
- Files: `packages/electron/src/main/chrome-login-import.ts`, `packages/electron/src/main/browser-automation-mcp.ts`
- Risk: A CORS or path change can accept cookies for a non-job domain, or a tool can act on the wrong tab, without a unit failure.
- Priority: High

**MITM proxy service:**
- What's not tested: Certificate generation, CA file modes, and the proxy server itself. Tests cover upstream proxy selection only.
- Files: `packages/core/src/proxy/certificates.ts`, `packages/core/src/proxy/service.ts`, `packages/core/test/unit/proxy/proxy-upstream.test.mjs`
- Risk: A bad CA lifetime, a world-readable key, or an intercept outside `DEFAULT_PROXY_TARGETS` ships without a test failure.
- Priority: High

**Home UI pages that hold the config editors:**
- What's not tested: `dashboard.tsx`, `settings.tsx`, and `App.tsx` have no matching test file. Provider behavior is covered in `packages/ui/test/integration/providers.test.ts` and component tests exist for layout, profiles, onboarding, and tray.
- Files: `packages/ui/src/pages/home/components/dashboard.tsx`, `packages/ui/src/pages/home/components/settings.tsx`, `packages/ui/src/pages/home/App.tsx`
- Risk: Save, dirty-state, and routing-editor regressions in those pages show up only in Playwright (`npm run test:e2e`), which is not part of `npm test`.
- Priority: Medium

**Route-script cancellation and host access:**
- What's not tested: Timeout tests exist for the runtime contract. They do not show that a timed-out `fetch` or `fs.writeText` has stopped, or that paths outside a root are rejected.
- Files: `packages/core/src/routing/route-script-worker.ts`, `packages/core/test/unit/routing/route-script-runtime.test.mjs`
- Risk: The timeout bug above stays green.
- Priority: High

**End-to-end and system tests are opt-in:**
- What's not tested: `npm test` does not run Playwright (`tests/e2e/`) or `tests/system/docker-smoke.mjs`.
- Files: `package.json`, `playwright.config.ts`, `tests/e2e/`, `tests/system/docker-smoke.mjs`
- Risk: CLI web startup, provider edit, and the Docker image can break while package unit tests stay green.
- Priority: Medium

---

*Concerns audit: 2026-11-14*

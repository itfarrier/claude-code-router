---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# Testing Patterns

**Analysis Date:** 2026-11-14

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) on Node `>=22` (`engines` in the root `package.json`). There is no Jest, Vitest, Mocha, or tap dependency in this repo.
- Config: `build/test.mjs` compiles tests. `build/run-tests.mjs` executes them. Playwright config is `playwright.config.ts`.
- Package scripts call those two files. `@claude-code-router/core` (`packages/core/package.json`):

```json
"test": "node ../../build/test.mjs core && node ../../build/run-tests.mjs core"
```

`@claude-code-router/ui`, `@claude-code-router/electron`, and `@musistudio/claude-code-router` (`packages/cli`) use the same pair with their project name.

**Assertion Library:**
- `node:assert/strict` for every `node:test` file. Import it as `import assert from "node:assert/strict"`.
- Playwright `expect` from `@playwright/test` (`^1.61.1`) for `tests/e2e/*.spec.ts` only. Do not mix `expect` into `node:test` files.

**Run Commands:**

```bash
npm test                          # every workspace package, then tests/architecture
npm run test:packages             # npm test in each workspace that has a test script
npm run test:core                 # @claude-code-router/core, all scopes
npm run test:ui                   # @claude-code-router/ui
npm run test:electron             # @claude-code-router/electron
npm run test:cli                  # @musistudio/claude-code-router
npm run test:architecture         # tests/architecture only
npm run test:main                 # core + electron
npm run test:renderer             # ui
npm test -w @claude-code-router/core   # same as test:core
# scoped package runs (directory name after --scope):
npm run test:unit -w @claude-code-router/core
npm run test:integration -w @claude-code-router/core
npm run test:unit -w @claude-code-router/ui
npm run test:component -w @claude-code-router/ui
npm run test:integration -w @claude-code-router/ui
npm run test:unit -w @claude-code-router/electron
npm run test:integration -w @musistudio/claude-code-router
npm run test:e2e                  # npm run build:assets && playwright test
npm run test:e2e:install          # playwright install chromium
npm run test:system               # tests/system/docker-smoke.mjs (Docker)
npm run test:docker               # alias of test:system
npm run typecheck                 # tsc --noEmit; not a test run
```

There is no watch script and no coverage script.

**How a package test run works:**
1. `build/test.mjs` bundles every `*.test.mjs`, `*.test.ts`, and `*.test.tsx` under the project test directory with esbuild. Output is `.test-dist/<project>/test/**/*.js` (gitignored). Format is CommonJS, target `node22`, JSX `automatic`. `better-sqlite3` and `electron` stay external. `@/` and `@ccr/(cli|core|electron|ui)/` resolve to `packages/<name>/src`.
2. `--scope <name>` limits compilation to `<testDir>/<name>`. The scope must be the directory name (`unit`, `integration`, `component`). An empty directory compiles nothing and the runner prints `No <project> tests found.`
3. For `core` and `cli`, the same esbuild step also emits runtime entry points under `.test-dist/<project>/runtime/` when the scope is omitted, `unit`, or `integration`. CLI tests spawn `.test-dist/cli/runtime/cli.js`. Core runtime entries include `gateway-bootstrap`, `router-plugin`, `request-log-worker`, `route-script-worker`, and the MCP servers listed in `build/test.mjs`.
4. `build/run-tests.mjs` starts one `node --test` (or Electron) process per project with every compiled `*.test.js`. It sets `HOME`, `CCR_INTERNAL_HOME_DIR`, `CCR_INTERNAL_APP_DATA_DIR`, and `CCR_INTERNAL_USER_DATA_DIR` to a fresh temp directory and deletes that directory after the project finishes.
5. `core` uses Node when `require("better-sqlite3")` loads. Otherwise it uses the Electron binary with `ELECTRON_RUN_AS_NODE=1`. `electron` tests always use that Electron path. `cli`, `ui`, and `architecture` use Node.
6. If `CCR_EXTENSIONS_DIR` or `../ccr-extensions` contains `plugins/claude-design/test`, the core run bundles those tests under `.test-dist/core/test/plugins/claude-design/`. A missing directory is skipped.

`docs/` (`docs/package.json`) has no test script. `cdn/` has no test script. Do not add tests for those packages unless the task is a docs or CDN behavior change that needs a runner.

## Test File Organization

**Location:**
- Tests are not colocated with `packages/*/src`. Each workspace owns `packages/<name>/test/`.
- Repo-level suites live in `tests/`. `tests/main` and `tests/renderer` must stay empty. `tests/architecture/package-boundaries.test.mjs` fails if source files appear there.

**Naming:**
- Node runner: `*.test.mjs`, `*.test.ts`, or `*.test.tsx`.
- Playwright: `*.spec.ts` under `tests/e2e/` only.
- `tests/system/docker-smoke.mjs` is a standalone script. It does not match the esbuild test glob and does not run under `npm test`.

**Structure:**

```
packages/core/test/
├── architecture/          # full `npm run test:core` only, not --scope unit|integration
├── integration/<domain>/*.test.mjs
├── support/loopback-listener.mjs
└── unit/<domain>/*.test.mjs
packages/ui/test/
├── component/*.test.tsx   # JSX; extensions.test.ts has no JSX
├── fixtures/index.ts
├── integration/*.test.ts
└── unit/*.test.ts         # two existing .mjs files stay .mjs
packages/electron/test/unit/*.test.ts
packages/cli/test/integration/cli-help.test.mjs
tests/architecture/*.test.mjs
tests/e2e/*.spec.ts
tests/e2e/cli-web-runtime.ts
tests/system/docker-smoke.mjs
```

**Where to add a test:**
- Core logic: `packages/core/test/unit/<domain>/<behavior>.test.mjs`. Use `.mjs` so the file matches the rest of core and stays outside `tsc`.
- Core behavior that binds a port, spawns a process, or opens SQLite for real: `packages/core/test/integration/<domain>/<behavior>.test.mjs`.
- A gateway layout rule (the facade must stay a facade): `packages/core/test/architecture/`. It runs only as part of the unscoped core test.
- A cross-package import or build-contract rule: `tests/architecture/<name>.test.mjs`. Wire it through `npm run test:architecture`, which `npm test` already calls.
- UI pure helpers: `packages/ui/test/unit/<subject>.test.ts`.
- UI markup: `packages/ui/test/component/<subject>.test.tsx`.
- UI flows that assemble several helpers without a browser: `packages/ui/test/integration/<subject>.test.ts`.
- Electron main-process helpers: `packages/electron/test/unit/<subject>.test.ts`.
- CLI flag parsing and help text: `packages/cli/test/integration/<subject>.test.mjs`, spawning the bundled runtime.
- A browser or built CLI HTTP flow: `tests/e2e/<subject>.spec.ts` plus a helper next to `tests/e2e/cli-web-runtime.ts` when the suite needs a process.
- A Docker image smoke check: extend `tests/system/docker-smoke.mjs`. Do not put it under `packages/*/test`.

Name the file after the module or the behavior, kebab-case: `config-repository-backup-deduplication.test.mjs`, `provider-edit.spec.ts`.

## Test Structure

**Suite Organization:**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { knownGatewayPluginDefaultApps } from "@ccr/core/contracts/app.ts";

test("known gateway plugin defaults open Claude Design at the current shell", () => {
  assert.equal(
    knownGatewayPluginDefaultApps(CLAUDE_DESIGN_PLUGIN_ID)?.find((app) => app.id === "claude-design")?.url,
    "https://claude-design.ccrdesk.top/design"
  );
});
```

The real assertion is in `packages/core/test/unit/contracts/app.test.mjs`. Copy that shape.

**Patterns:**
- One behavior per `test()`. The title is a sentence in present tense that states the outcome.
- A regression for a GitHub issue starts with `#<number>`: `test("#1867 unexpected core exit restarts with bounded backoff", ...)` in `packages/core/test/unit/gateway/core-restart.test.mjs`.
- Do not wrap `node:test` cases in `describe`. Keep the file a flat list of `test()` calls plus helpers under them.
- Playwright may use `test.describe` for a locale group (`tests/e2e/opencode-go-import.spec.ts`) and `test.beforeAll` / `test.afterAll` for a shared server (`tests/e2e/cli-web.spec.ts`).
- Per-test cleanup uses `t.after(() => ...)` or `try/finally`. Module cleanup uses `test.after(() => ...)`. `packages/core/test/unit/routing/route-script-runtime.test.mjs` removes its temp directory with `test.after`.
- Async tests are `async` functions. The runner awaits them. After `t.mock.timers.tick`, flush microtasks with `await Promise.resolve()` twice, as `core-restart.test.mjs` does, before asserting work that was queued from a timer.
- A skipped live test uses the `node:test` options object, not a comment:

```js
test("recent issues: production HTTP, OAuth rotation, tool replay, logs and usage SQLite", {
  skip: !gatewayEntry && "set CCR_TEST_GATEWAY_ENTRY to the gateway production entry",
  timeout: 60000
}, async (t) => { /* ... */ });
```

That skip lives in `packages/core/test/integration/gateway/recent-issues-wire.test.mjs`. `packages/core/test/integration/mcp/local-ai-gateway-media-live.test.mjs` skips unless `CCR_LIVE_GROK_MEDIA=1`.

- Import order in a test: `node:assert/strict`, other `node:` modules, `node:test`, then `@ccr/.../*.ts` (or `.tsx`). Always include the source extension. esbuild resolves it. `tsc` does not typecheck these files.
- Helpers are functions in the same file. Share a fixture only when a second file needs the same data.

**Assertions:**
- `assert.equal` for scalars. `assert.deepEqual` for objects and arrays.
- `assert.match` / `assert.doesNotMatch` for command output, HTML, and error text.
- `assert.ok` for presence.
- `assert.throws(fn, /message/)` for sync failures.
- `await assert.rejects(promiseOrFn, /message/)` for async failures. `packages/core/test/unit/config/theme-preference.test.mjs` rejects `/Configuration changed/` and `/Invalid theme preference/`.
- Pass a string as the last argument when the failure would otherwise be ambiguous (`assert.equal(result.status, 0, result.stderr)` in `packages/cli/test/integration/cli-help.test.mjs`).
- Playwright: `expect(locator).toBeVisible()`, `toHaveTitle`, `toContainText`, `expect(response.status()).toBe(200)`.

## Mocking

**Framework:** `node:test` mocks (`t.mock.method`, `t.mock.timers`). No Sinon, `mock.module`, or Vitest `vi`.

**Patterns:**

```js
test("#1867 unexpected core exit restarts with bounded backoff", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { child, service } = crashedService();
  service.startGateway = async () => {
    service.status.state = "error";
    return service.getStatus();
  };
  await service.handleCoreGatewayTermination(child, undefined, "heap OOM");
  t.mock.timers.tick(1000);
  await Promise.resolve();
});
```

```js
const probe = t.mock.method(childProcess, "spawnSync", () => ({
  stdout: "2.1.235 (Claude Code)",
  status: 0
}));
```

`spawnSync` replacement is `packages/core/test/unit/agents/claude-code-auth-mode.test.mjs`. `fs.statSync` / `fs.existsSync` replacement is `packages/core/test/unit/agents/app-info-paths.test.mjs`. Fetch replacement is `t.mock.method(globalThis, "fetch", ...)` in `packages/electron/test/unit/claude-design-window.test.ts`.

Replace a global by assignment only when `mock.method` does not fit, and always restore it:

```js
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.map(String).join(" "));
try {
  // exercise the code
} finally {
  console.warn = originalWarn;
}
```

`packages/core/test/integration/plugins/plugin-service.test.mjs` does this. `packages/core/test/unit/providers/provider-probe.test.mjs` saves `globalThis.fetch` and restores it in `t.after`.

**What to Mock:**
- Child-process launches (`spawn`, `spawnSync`) when the test is about arguments, not the real binary.
- `fetch` when the test is about status handling, not a live provider.
- Timers when the test is about backoff. Enable only the API the code uses (`{ apis: ["setTimeout"] }`).
- A method on the service under test (`service.startGateway = async () => ...`) when the test is about the caller, not the callee.

**What NOT to Mock:**
- `better-sqlite3`, the config repository, or the usage store in an integration test. Open a temp database.
- The module under test. Call the exported function.
- React rendering. Do not mock `react-dom/server`.
- Clock and filesystem together in a way that hides the race the test claims to lock. The wire suites in `packages/core/test/integration/gateway/` start a real `node:http` server.

## Fixtures and Factories

**Test Data:**

```ts
import { appConfigFixture } from "../fixtures/index.ts";

const config = appConfigFixture();
config.profile.profiles = [{
  agent: "claude-code",
  enabled: true,
  id: "claude",
  model: "Provider/claude-sonnet",
  name: "Claude",
  scope: "ccr"
}];
```

`appConfigFixture()` is in `packages/ui/test/fixtures/index.ts`. It returns a partial `AppConfig` cast through `as unknown as AppConfig`. Extend it for UI unit tests. Core tests call `createDefaultAppConfig()` from `@ccr/core/config/default-config.ts` instead.

`installBrowserGlobals()` in the same fixtures file installs a minimal `window` and `document` on `globalThis` for tray and storage tests. UI component tests do not need it when they only call `renderToStaticMarkup`.

**Location:**
- Shared UI data: `packages/ui/test/fixtures/index.ts`.
- Shared TCP wait: `waitForTcpListener` in `packages/core/test/support/loopback-listener.mjs`. New loopback tests may inline `http.createServer` plus `listen(0, "127.0.0.1")` the way `packages/core/test/unit/media/media-executor-download.test.mjs` does. Close the server in `finally`.
- Temp directories: `mkdtempSync(path.join(tmpdir(), "ccr-<subject>-"))` and `rmSync(..., { force: true, recursive: true })` in `t.after` or `finally`. Prefix the directory with `ccr-`.
- Playwright homes: `tests/e2e/cli-web-runtime.ts` uses `os.tmpdir()` / `ccr-playwright-home-` and sets the same `CCR_INTERNAL_*` variables the package runner sets.
- Do not commit fixtures that contain real API keys. Tokens in e2e files are fixed test strings (`playwright-cli-web-auth-token`).

**Process isolation:**
- Files in one `node --test` invocation share the temp home from `build/run-tests.mjs`. Node runs test files in parallel child processes. Two files that both call `saveAppConfig` / `loadAppConfig` can race on that home.
- A new test that persists config gives itself a private directory and points the store at that path, as `plugin-service.test.mjs` does. Use the shared home only when the test is specifically about the process config directory, and keep every write for that behavior in one file.
- Do not read or write the developer home. The runner replaces `HOME`.

## Coverage

**Requirements:** None enforced

No c8, nyc, or Istanbul config exists. `npm test` does not collect coverage. Do not add a coverage gate as part of a feature change.

**View Coverage:**

```bash
# Not applicable
```

## Test Types

**Unit Tests:**
- Import the function or class and assert its return value or thrown message.
- Core unit tests stay in `packages/core/test/unit/**/*.test.mjs`. They may touch SQLite when the module under test is the repository (`packages/core/test/unit/config/theme-preference.test.mjs` calls `loadAppConfig` and `saveAppThemePreference`).
- UI unit tests assert data helpers, not HTML (`packages/ui/test/unit/routing.test.ts`).
- Electron unit tests import `@ccr/electron/main/<file>.ts` and assert pure decisions (`packages/electron/test/unit/launch-at-login.test.ts`).
- Replace collaborators with `t.mock.method` or a one-line assignment. Do not start the gateway.

**Integration Tests:**
- Core integration tests in `packages/core/test/integration/` exercise a real boundary: plugin load (`plugin-service.test.mjs`), HTTP plus SQLite (`recent-issues-wire.test.mjs`, `october-issues-wire.test.mjs`), MCP stdio (`toolhub-mcp-runtime.test.mjs`), request-log storage (`request-log-store.test.mjs`).
- A wire test that needs the production gateway bundle skips unless `CCR_TEST_GATEWAY_ENTRY` is set. Do not make `npm test` depend on that variable.
- CLI integration tests spawn the esbuild runtime, not `tsx` and not the published `dist` tree:

```js
const cliRuntime = path.join(process.cwd(), ".test-dist", "cli", "runtime", "cli.js");
const result = spawnSync(process.execPath, [cliRuntime, ...args], {
  encoding: "utf8",
  env: { ...process.env, CCR_CLI_COMMAND_NAME: "ccr" }
});
assert.equal(result.status, 0, result.stderr);
```

That helper is `runCli` in `packages/cli/test/integration/cli-help.test.mjs`. Assert both status and stderr or stdout.

- UI integration tests call the same helpers the page uses and assert the resulting data (`packages/ui/test/integration/providers.test.ts`). They do not open a browser.

**Component Tests:**
- Render with `renderToStaticMarkup` from `react-dom/server`. Do not add Testing Library, jsdom, or happy-dom.
- Wrap copy-sensitive trees in `AppI18nContext.Provider` with `appCopy.en` or `appCopy.zh` from `@ccr/ui/pages/home/shared/i18n.tsx`.
- Assert role, text, and class with `assert.match` / `assert.doesNotMatch`. `packages/ui/test/component/ux-feedback.test.tsx`:

```tsx
test("dialog accessible name refers to its rendered title", () => {
  const html = renderToStaticMarkup(
    <Dialog><DialogContent><DialogTitle>Edit provider</DialogTitle></DialogContent></Dialog>
  );
  const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(titleId);
  assert.ok(html.includes(`id="${titleId}"`));
});
```

- Pass `() => {}` for unused callbacks. Do not simulate clicks. A behavior that needs a click belongs in `tests/e2e/`.

**E2E Tests:**
- Playwright, Chromium only, one worker, `fullyParallel: false`. `playwright.config.ts` sets `timeout: 30_000`, `expect.timeout: 10_000`, `use.actionTimeout: 10_000`, `trace: "retain-on-failure"`, `forbidOnly` when `CI` is set. Reporter is `list`. On `CI` it is `list` plus HTML with `open: "never"`.
- `npm run test:e2e` builds assets first. `tests/e2e/cli-web-runtime.ts` spawns `packages/cli/dist/main/cli.js`, so a spec that uses `startCliWebServer` fails without that build.
- Auth is the test token passed as `CCR_WEB_AUTH_TOKEN` and sent as the `x-ccr-web-auth` header. `tests/e2e/cli-web.spec.ts` checks the UI, static assets, a successful RPC, and a 401 without the token.
- Desktop specs connect over CDP (`tests/e2e/electron-cdp.spec.ts`). They use `chromium` from `@playwright/test` directly.
- `test-results/`, `playwright-report/`, and `blob-report/` are gitignored. Do not commit them.
- Playwright is not part of `npm test`. Run `npm run test:e2e` when the change touches `tests/e2e/`, the web RPC surface, or the built management UI.

**System Tests:**
- `npm run test:system` runs `node tests/system/docker-smoke.mjs`. It builds `claude-code-router:local` unless `CCR_DOCKER_TEST_SKIP_BUILD=1`, publishes only port 8080, and asserts the Nginx redirect plus the management page. It uses `node:assert/strict` and `fetch`. It is not part of `npm test`.

**Architecture Tests:**
- `tests/architecture/package-boundaries.test.mjs` checks package test scripts, forbids `packages/*/src` relative imports across packages, and checks Docker build scripts.
- `tests/architecture/ui-build-contract.test.mjs` checks that the home HTML loads `web-client-bridge.js` before the app bundle.
- `packages/core/test/architecture/gateway-service-architecture.test.mjs` checks that `packages/core/src/gateway/service.ts` stays a re-export facade.

**CI:**
- `.github/workflows/release.yml`, `.github/workflows/docker-release.yml`, and `.github/workflows/docs.yml` do not run `npm test` or Playwright.
- `.github/actions/prepare-release-gateway/action.yml` typechecks and runs Vitest inside a checkout of `The-NeXT-AI/ai-gateway`. That is not this repo's runner. Do not import Vitest here to match that action.

## Common Patterns

**Async Testing:**

```js
test("download releases the response body when the declared artifact is too large", async () => {
  const { closed, port, server } = await stalledArtifactServer(200);
  const executor = loopbackExecutor(port);
  try {
    await assert.rejects(
      executor.download({ fileName: "artifact.bin", remoteUrl: `http://127.0.0.1:${port}/artifact` }, new AbortController().signal),
      /exceeds the 250 MB limit/
    );
    assert.equal(await connectionClosedWithin(closed, 2000), true);
  } finally {
    server.close();
  }
});
```

The helper and the test are in `packages/core/test/unit/media/media-executor-download.test.mjs`. Bind loopback servers to `127.0.0.1` and port `0`.

Wait for a condition with a deadline loop and a short `setTimeout`, or with `waitForTcpListener` from `packages/core/test/support/loopback-listener.mjs`. Do not `sleep` a fixed long delay as the only signal.

**Error Testing:**

```js
await assert.rejects(saveAppConfig(staleConfig), /Configuration changed/);

assert.throws(() => findProfileForOpen(config, "duplicate name"), /ambiguous/);
```

The first line is `packages/core/test/unit/config/theme-preference.test.mjs`. The second shape is `packages/core/test/unit/profiles/profile-launch-core.test.mjs`. Match the stable part of the message, not the whole sentence, unless the exact sentence is the contract.

CLI failures assert `result.status` and `assert.match(result.stderr, /Invalid port: invalid/)`.

Playwright auth failure:

```ts
expect(response.status()).toBe(401);
expect(payload.ok).toBe(false);
```

from `tests/e2e/cli-web.spec.ts`.

**HTML and accessibility:**
- Assert `role="alert"`, `role="status"`, `aria-labelledby`, and the visible string.
- Assert the absence of a leaked control with `assert.doesNotMatch`.
- For translated UI, render with `appCopy.zh` and match the Chinese string (`更改尚未保存` in `ux-feedback.test.tsx`).

**Imports the runner must resolve:**
- `@ccr/core/.../*.ts`, `@ccr/ui/.../*.ts`, `@ccr/ui/.../*.tsx`, `@ccr/electron/.../*.ts`.
- A relative fixture import includes `.ts`: `../fixtures/index.ts`.
- Do not import another package with a relative `packages/<name>/src` path.

---

*Testing analysis: 2026-11-14*

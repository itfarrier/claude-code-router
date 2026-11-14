---
last_mapped_commit: 057abaa1f95519ab8faf999e1ccef2b80ccdeb9e
last_mapped_at: 2026-11-14
---
# Coding Conventions

**Analysis Date:** 2026-11-14

## Naming Patterns

**Files:**
- Use kebab-case for source and test files: `packages/core/src/config/config-repository.ts`, `packages/ui/src/pages/home/components/unsaved-changes.tsx`, `packages/core/test/unit/gateway/core-restart.test.mjs`.
- Match the directory to the domain (`gateway`, `providers`, `profiles`, `observability`, `mcp`, `agents`).
- Keep these existing page roots in PascalCase. Do not add more PascalCase files:
  - `packages/ui/src/pages/home/App.tsx`
  - `packages/ui/src/pages/tray/TrayApp.tsx`
  - `packages/ui/src/pages/tray/TrayDetailApp.tsx`
- Provider presets live at `packages/core/src/providers/presets/<preset-id>/index.ts`.
- Test file suffixes are fixed. See TESTING.md. Do not colocate `*.test.*` next to `packages/*/src`.

**Functions:**
- Use camelCase. Start booleans with `is`, `has`, or `should`: `isLaunchAtLoginSupported`, `shouldApplyGatewayRouting`, `hasValidWebAuthToken`.
- Use a verb for an operation (`saveAppConfig`, `formatError`, `waitForTcpListener`) and a noun for a factory (`createDefaultAppConfig`, `appConfigFixture`).
- React props that notify the parent use an `on` prefix: `onClose`, `onCheckedChange`, `onRetry`.
- Module-level helpers are `function` declarations. Use arrow functions for callbacks and for values passed inline.

**Variables:**
- Use camelCase for locals, parameters, and module singletons: `gatewayService`, `pluginService`, `mediaService`, `trayController`.
- Use SCREAMING_SNAKE_CASE for exported protocol, path, and tool constants. Define path constants in `packages/core/src/config/constants.ts` and protocol constants in `packages/core/src/contracts/app.ts`:

```ts
export const APP_CONFIG_DB_FILE = path.join(CONFIGDIR, "config.sqlite");
export const BUILTIN_FUSION_WEB_SEARCH_TOOL_NAME = "web_search";
```

- Use camelCase for a constant that is not part of that public contract surface (`appConfigKey`, `languagePreferenceStorageKey`).
- Name an options bag `<Subject>Options` and a result `<Subject>Result`.

**Types:**
- Use PascalCase.
- Domain data is `export type`, not `interface`:

```ts
export type UsageCostInput = {
  cacheReadTokens?: number;
  model?: string;
  provider?: string;
};
```

- React props that extend a DOM attribute interface are `export interface`: `BadgeProps` in `packages/ui/src/components/ui/badge.tsx`, `CheckboxProps` in `packages/ui/src/components/ui/checkbox.tsx`.
- Error types are classes: `AppConfigConflictError`, `ProfileGatewayUnavailableError`, `UpstreamRequestError`.
- Service classes are PascalCase and end in `Service` when they own a process or store: `GatewayService`, `MediaService`, `ConfigRepository`.

## Code Style

**Formatting:**
- No Prettier, Biome, or EditorConfig config is present. Match the surrounding file.
- Indent with 2 spaces.
- Use double quotes for strings.
- End statements with semicolons.
- Put a trailing comma on multiline objects, arguments, union members, and type fields.
- Write large numeric literals with a numeric separator when the file already does (`10_000`, `30_000` in `playwright.config.ts`).
- Keep object and type fields in the order the surrounding module uses. Do not reorder fields only to alphabetize them.
- JSX uses the `react-jsx` runtime from `tsconfig.json`. A file that references `React.` imports `import * as React from "react"` (`packages/ui/src/components/ui/badge.tsx`). A file that only needs hooks imports those hooks by name.

**Linting:**
- ESLint, Biome, and oxlint are not configured. Do not add a linter config as part of a feature change.
- `tsconfig.json` is the style gate:
  - `"strict": true`
  - `"noUnusedLocals": true`
  - `"noUnusedParameters": true`
  - `"target": "ESNext"`
  - `"module"` and `"moduleResolution"`: `"NodeNext"`
  - `"jsx": "react-jsx"`
- Run `npm run typecheck` (`tsc --noEmit`) before a publish. `prepublishOnly` in the root `package.json` runs that command.
- The typecheck include is `packages/*/src/**/*.ts`, `packages/*/src/**/*.tsx`, and `tests/e2e/**/*.ts`. Package tests under `packages/*/test` are outside `tsc`. A `.ts` unit test must still be valid TypeScript because `build/test.mjs` bundles it with esbuild.
- Package tsconfigs (`packages/core/tsconfig.json`, `packages/ui/tsconfig.json`, `packages/cli/tsconfig.json`, `packages/electron/tsconfig.json`) extend the root config and set `"rootDir": "src"`.

**TypeScript details future code must follow:**
- Type `unknown` at a trust boundary, then narrow. Do not use `any`.
- Put `type` on type-only specifiers: `import type { AppConfig } from "@ccr/core/contracts/app"` or `import { fn, type AppConfig } from "..."`.
- Class fields use TypeScript `private` / `private readonly`. Do not use ECMAScript `#` fields. The only `#` hit in `packages/` is a CSS rule in `packages/ui/src/pages/browser/main.tsx`.
- Cross-package source must not contain a relative path into `packages/<other>/src`. `tests/architecture/package-boundaries.test.mjs` fails the build when that pattern appears. Use the aliases below.

## Import Organization

**Order:**
1. `node:` built-ins (`node:fs`, `node:path`, `node:crypto`, `node:child_process`).
2. Third-party packages (`react`, `electron`, `clsx`, `lucide-react`, `tailwind-merge`).
3. `@ccr/*` and `@/` aliases.
4. Relative imports (`./common`, `./types`).
5. A `import type` from the same module comes after the value import, or the type sits inline on the value import.

`packages/core/src/agents/local-providers/kimi.ts` is the pattern for core modules: `node:` imports, then `import type`, then `@ccr/core/...`.

UI primitives put React first, then the alias, as in `packages/ui/src/components/ui/checkbox.tsx`:

```ts
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
```

Electron and CLI entry files may import the platform package before `node:` (`electron` in `packages/electron/src/main/main.ts`). New core modules keep `node:` first.

**Extensions:**
- Static imports in `packages/*/src` omit the file extension: `@ccr/core/config/constants`, `./unsaved-changes`, `@/lib/utils`.
- The one Node dynamic import keeps the runtime extension. `packages/electron/src/main/main.ts` loads `./main-app.js`. New dynamic imports that Node executes use the `.js` extension of the emitted file.
- Tests bundled by `build/test.mjs` include the source extension: `@ccr/core/config/config.ts`, `@ccr/ui/pages/home/components/feedback.tsx`.

**Path Aliases:**
- `@/*` → `packages/ui/src/*` (UI source only)
- `@ccr/cli/*` → `packages/cli/src/*`
- `@ccr/core/*` → `packages/core/src/*`
- `@ccr/electron/*` → `packages/electron/src/*`
- `@ccr/ui/*` → `packages/ui/src/*`

Inside `packages/core`, import another core module with `@ccr/core/...`. Use a relative import only for a sibling in the same directory. The same rule applies to `packages/cli`, `packages/electron`, and `packages/ui`.

Do not add a new alias. `build/test.mjs` and `tsconfig.json` both resolve the aliases above. A new alias must be added in both or tests and `tsc` disagree.

## Error Handling

**Patterns:**
- Throw `new Error("Specific sentence.")` for programmer and operator failures: bad CLI flags in `packages/core/src/entrypoints/server.ts`, missing MCP arguments in `packages/core/src/mcp/network-capture-mcp.ts`, invalid plugin paths in `packages/core/src/gateway/claude-code-router-plugin.ts`.
- A named failure that callers branch on is a class that extends `Error`, sets `this.name`, and uses a fixed sentence:

```ts
export class AppConfigConflictError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("Configuration changed since it was loaded. Reload the configuration and reapply your changes before saving.");
    this.name = "AppConfigConflictError";
  }
}
```

That class lives in `packages/core/src/config/config-repository.ts`. `ProfileGatewayUnavailableError` lives in `packages/core/src/profiles/launch-service.ts`. `UpstreamRequestError` lives in `packages/core/src/gateway/internal/shared.ts` and carries `attempt`, `failedAttempts`, and `cause`.

- Convert `unknown` with the local formatter. Copy this shape. Do not add a new error package:

```ts
function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

The shared gateway copy is `formatError` in `packages/core/src/gateway/http/io.ts`. Upstream logs use `formatUpstreamErrorForLog` in the same file. UI copy uses `formatAppError` in `packages/ui/src/pages/home/shared/i18n.tsx`, which translates `error.message`.

- Recoverable I/O logs the formatted error and continues with a fallback. `fetchPluginMarketplace` in `packages/core/src/plugins/marketplace.ts` catches, warns, and returns the cached manifest.
- HTTP and RPC boundaries return a status. They do not throw out of the request handler. `handleRpcRequest` in `packages/core/src/web/management-server.ts` responds `{ ok: false, error: { message } }` with 400, 401, 404, 405, 415, or 500. `AppConfigConflictError` maps to 409 by `error.name`. Success is `{ ok: true, value }`.
- CLI entrypoints write the message to stderr and set `process.exitCode = 1`. `packages/cli/src/cli.ts` and `packages/core/src/entrypoints/server.ts` both end in `.catch`. Do not call `process.exit` for a normal command failure. The core server uses `process.exit` only after a signal shutdown (`SIGINT` → 130, `SIGTERM` → 143).
- Electron startup reports a fatal error once. `packages/electron/src/main/main.ts` registers `uncaughtException` and `unhandledRejection` only until `./main-app.js` loads, and `fatalStartupErrorReported` blocks a second dialog.
- Preserve `cause` when wrapping an upstream failure (`UpstreamRequestError`). Do not drop the original error on a retry path.

## Logging

**Framework:** `console` in services. `process.stdout` / `process.stderr` in CLI entrypoints. No pino, winston, or other logger package.

**Patterns:**
- Prefix service warnings with the subsystem in brackets and append `formatError(error)`:

```ts
console.warn(`[gateway] Core gateway restart failed: ${formatError(error)}`);
console.warn(`[plugin-marketplace] Failed to fetch marketplace from ${url}: ${formatError(error)}`);
console.warn(`[web] Failed to open ${url}: ${formatError(error)}`);
```

- Use `console.warn` for a recoverable failure and `console.error` when the saved runtime is wrong (`Failed to reload persisted runtime configuration` in `packages/core/src/gateway/application/gateway-service.ts`).
- User-facing CLI text goes through `process.stdout.write` and `process.stderr.write`, including the trailing newline. Do not `console.log` command output.
- Do not log secrets, API keys, or raw request bodies. Upstream diagnostic text goes through `formatUpstreamErrorForLog`, which redacts credential values.
- Test code may replace `console.warn` and restore it in `finally` or `t.after`. Production code must not depend on that replacement.

## Comments

**When to Comment:**
- Comment only the constraint the code cannot show. One line, `/** ... */` or `//`.
- Examples to copy:
  - `packages/ui/src/pages/home/components/unsaved-changes.tsx`: `/** Drafts stay in their parent while the user decides whether to leave. */`
  - `packages/core/src/config/config.ts`: `/** Save settings; change gateway credentials through saveApiKeysConfig instead. */`
  - `packages/core/src/gateway/service.ts` file comment: the file is a compatibility facade so Electron, CLI, web, and tests keep a stable import path.
- A test helper that exists to force a race or a leak gets a short `//` block. See `createService` in `packages/core/test/unit/gateway/core-restart.test.mjs` and `stalledArtifactServer` in `packages/core/test/unit/media/media-executor-download.test.mjs`.
- Do not narrate what the next line does. Do not add TODO/FIXME as a feature placeholder.

**JSDoc/TSDoc:**
- Use a one-line block comment, not a `@param` / `@returns` block. Multi-line blocks are only for a module facade or a non-obvious protocol rule (`packages/core/src/mcp/fusion-vision-mcp.ts`).
- Do not generate JSDoc for exported functions that the signature already explains.

## Function Design

**Size:**
- Put new behavior in the module that already owns the data. `packages/cli/src/cli.ts`, `packages/core/src/config/config.ts`, `packages/core/src/profiles/service.ts`, and `packages/ui/src/pages/home/App.tsx` are already large. Add a focused module and re-export it from the existing facade instead of growing a second public entry.
- The gateway facade rule is enforced by `packages/core/test/architecture/gateway-service-architecture.test.mjs`: `packages/core/src/gateway/service.ts` stays a re-export file, and gateway implementation modules do not import that facade.

**Parameters:**
- One to three positional parameters for a pure helper.
- An options object typed as `<Name>Options` when the call has several independent flags. `ConfigRepository` takes `(dbFile, options)`.
- Default parameters are inline (`options: ConfigRepositoryOptions = {}`). Do not add a configuration framework for one call site.
- React components take one props object. Primitive UI components forward the rest of the DOM props with `...props`.

**Return Values:**
- Exported core, CLI, and Electron functions declare a return type (`Promise<void>`, `string`, `Promise<unknown | undefined>`).
- React components and hooks may omit the return type. `useDraftClose` in `packages/ui/src/pages/home/components/unsaved-changes.tsx` returns `{ close, confirmation }`.
- Async functions return a Promise. Do not return a bare Promise from a function that is not `async` unless it forwards one.
- A function that means "nothing found" returns `undefined`. A function that means "caller violated a contract" throws. An HTTP handler returns status plus `{ ok: false }`.

**React:**
- Page UI is function components. There are no `React.Component` classes.
- Primitives in `packages/ui/src/components/ui/` use `React.forwardRef`, set `displayName`, and merge classes with `cn` from `packages/ui/src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- Home screens mount through `packages/ui/src/pages/home/main.tsx`: `BaseUiProvider` from `packages/ui/src/lib/baseui-provider.tsx`, then the default export `App`.
- User-visible strings go through `useAppText()` / `AppI18nContext` in `packages/ui/src/pages/home/shared/i18n.tsx`. Tray copy uses `useTrayText()` in `packages/ui/src/pages/tray/shared.tsx`. English is the key. Add the same key to the `en` and `zh` copy tables.
- Show a caught error with `formatAppError(copy, error)` or `useAppErrorText()`. Do not render `String(error)` directly.

## Module Design

**Exports:**
- Use named exports.
- Default export is reserved for the three existing modules. Do not add another:
  - `export default App` in `packages/ui/src/pages/home/App.tsx`
  - `export default trayController` in `packages/electron/src/main/tray-controller.ts`
  - `export default windowsManager` in `packages/electron/src/main/windows.ts`
- A long-lived service is a class plus one module singleton:

```ts
export const gatewayService = new GatewayService();
export const pluginService = new GatewayPluginService();
```

Singletons live next to the class: `packages/core/src/gateway/application/gateway-service.ts`, `packages/core/src/plugins/service.ts`, `packages/core/src/media/service.ts`, `packages/core/src/proxy/service.ts`. Tests that need a clean instance construct through the existing class (`new gatewayService.constructor()` in `packages/core/test/unit/gateway/core-restart.test.mjs`) or call a factory. Do not add a second singleton.

- CLI and the core server start with `#!/usr/bin/env node` and call their `main` / `runCoreServer` at the bottom of the file.
- Side effects on import are limited to process hooks that must run before the rest of the module (`installSocketTypeOfServiceCompat()` in `packages/cli/src/cli.ts` and `packages/electron/src/main/main.ts`). Do not open the database or listen on a port at import time.

**Barrel Files:**
- Re-export from `index.ts` only where a barrel already exists:
  - `packages/ui/src/pages/home/components/index.ts`
  - `packages/ui/src/pages/tray/components/index.ts`
  - `packages/core/src/providers/presets/index.ts` and each `packages/core/src/providers/presets/<id>/index.ts`
  - `packages/core/src/gateway/features/hosted-web-search/index.ts` (the public facade for that feature)
- `packages/core/src/gateway/service.ts` is the gateway compatibility barrel. Add a gateway feature by exporting it from there when Electron, CLI, or tests already import the facade.
- Do not add a barrel for a new core domain directory.

---

*Convention analysis: 2026-11-14*

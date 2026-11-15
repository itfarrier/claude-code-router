import assert from "node:assert/strict";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { IPC_CHANNELS } from "@ccr/core/contracts/ipc-channels.ts";
import { recordSwapNotice } from "@ccr/core/class-switch/notice.ts";
import { clearSwapNotice, getSwapNotice } from "@ccr/core/class-switch/seam.ts";

// The established runner (build/run-tests.mjs) executes electron tests as
// `electron --test` with ELECTRON_RUN_AS_NODE=1, so require("electron") yields
// the launcher binary path string, never the runtime API. No repository test
// fakes runtime Electron APIs, so this test installs a fake electron module in
// require.cache before importing the real compiled ipc.ts, records every
// ipcMain.handle registration, and restores the prior cache entry afterwards.
const require = createRequire(path.resolve(process.cwd(), "package.json"));
const electronModulePath = require.resolve("electron");

function fakeElectronModule() {
  const registrations = [];
  const ipcMain = {
    handle: (channel, handler) => {
      registrations.push({ channel, handler });
    }
  };
  const electron = {
    app: {
      getAppPath: () => path.resolve(process.cwd(), "packages/electron"),
      getLoginItemSettings: () => ({}),
      getPath: (name) => path.join(os.tmpdir(), `ccr-swap-notice-ipc-test-${name}`),
      getVersion: () => "3.1.3-test",
      isPackaged: false,
      isReady: () => false,
      on: () => undefined,
      quit: () => undefined,
      setAsDefaultProtocolClient: () => undefined,
      setLoginItemSettings: () => undefined,
      whenReady: () => Promise.resolve()
    },
    BrowserWindow: class FakeBrowserWindow {},
    WebContentsView: class FakeWebContentsView {},
    clipboard: { readText: () => "", writeText: () => undefined },
    contextBridge: { exposeInMainWorld: () => undefined },
    dialog: {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true }),
      showErrorBox: () => undefined
    },
    ipcMain,
    ipcRenderer: { invoke: async () => undefined, on: () => undefined, removeListener: () => undefined },
    Menu: { buildFromTemplate: () => undefined, setApplicationMenu: () => undefined },
    nativeImage: { createEmpty: () => ({ isEmpty: () => true, toDataURL: () => "", toPNG: () => Buffer.alloc(0) }) },
    nativeTheme: { on: () => undefined, shouldUseDarkColors: false, themeSource: "system" },
    screen: {
      getPrimaryDisplay: () => ({ workAreaSize: { height: 800, width: 1200 } }),
      on: () => undefined
    },
    session: {
      fromPartition: () => ({ forceReloadProxyConfig: async () => undefined, setProxy: async () => undefined })
    },
    shell: { openExternal: async () => undefined, openPath: async () => "", showItemInFolder: () => undefined },
    Tray: class FakeTray {},
    webUtils: { getPathForFile: () => "" }
  };
  return { electron, registrations };
}

test("desktop IPC returns the current swap notice through the seam", async () => {
  const { electron, registrations } = fakeElectronModule();
  const previousElectronEntry = require.cache[electronModulePath];
  const swapNotice = {
    credentialLabel: "cred:sonnet",
    model: "sonnet-live",
    provider: "SonnetProvider",
    reason: "no live Opus triple",
    requestedClass: "opus",
    safeguardsApplies: false,
    servedClass: "sonnet",
    sinceAt: "2026-11-15T10:00:00.000Z"
  };
  require.cache[electronModulePath] = { exports: electron, filename: electronModulePath, id: electronModulePath, loaded: true, path: path.dirname(electronModulePath) };
  let ipc;
  try {
    ipc = await import("@ccr/electron/main/ipc.ts");

    const swapNoticeRegistrations = registrations.filter((registration) => registration.channel === IPC_CHANNELS.appGetSwapNotice);
    assert.equal(IPC_CHANNELS.appGetSwapNotice, "ccr:app:get-swap-notice");
    assert.equal(swapNoticeRegistrations.length, 1);
    assert.equal(typeof swapNoticeRegistrations[0].handler, "function");

    recordSwapNotice(swapNotice);
    const seamRead = await getSwapNotice();
    assert.deepEqual(seamRead, swapNotice);
    const handlerResult = await swapNoticeRegistrations[0].handler({ sender: "sentinel-event" });
    assert.deepEqual(handlerResult, swapNotice);
    assert.deepEqual(handlerResult, seamRead);

    clearSwapNotice();
    assert.equal(await getSwapNotice(), null);
    assert.equal(await swapNoticeRegistrations[0].handler({ sender: "sentinel-event" }), null);
  } finally {
    clearSwapNotice();
    if (previousElectronEntry) {
      require.cache[electronModulePath] = previousElectronEntry;
    } else {
      delete require.cache[electronModulePath];
    }
  }
});

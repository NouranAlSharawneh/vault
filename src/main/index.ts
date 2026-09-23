import { electronApp, optimizer } from "@electron-toolkit/utils";
import { app, dialog, globalShortcut, nativeTheme } from "electron";
import { APP_ID } from "@shared/constants";
import { attachContextMenu } from "./app/context-menu/context-menu";
import { registerHotkey } from "./app/hotkey/hotkey";
import { registerIpcHandlers } from "./app/ipc/ipc";
import { buildAppMenu } from "./app/menu/menu";
import { registerAssetProtocol, registerAssetScheme } from "./app/protocol/protocol";
import { showMainWindow } from "./app/session/launch-route";
import { session } from "./app/session/session";
import { fire } from "./lib/fire";
import { configureNetwork } from "./network/axios";
import { getSettings } from "./store/settings.store";
import { loadToken } from "./store/token.store";
import { getCaptureWindow, getMainWindow, IS_MAC } from "./windows";

if (!app.requestSingleInstanceLock()) app.quit();

registerAssetScheme();

// A second launch can arrive before this one has restored the session; wait for it, or the
// window would open before the app is ready and on the wrong route.
app.on("second-instance", () => fire(boot.then(showMainWindow), "showing the main window"));

const boot = app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID);
  nativeTheme.themeSource = "light";
  app.on("browser-window-created", (_, w) => {
    optimizer.watchWindowShortcuts(w);
    attachContextMenu(w.webContents);
  });

  configureNetwork({
    getToken: loadToken,
    onAuthExpired: () => fire(session.revalidate(), "revalidating the token"),
  });
  registerIpcHandlers();
  registerAssetProtocol();
  await session.restore();

  const settings = getSettings();
  buildAppMenu(settings.vault?.hotkey);
  if (settings.vault && session.vault) registerHotkey(settings.vault.hotkey);
  getCaptureWindow(); // pre-warm so the sheet appears instantly
  showMainWindow();

  // The dock icon brings the vault back even when only editor windows are open.
  app.on("activate", () => {
    if (!getMainWindow()) showMainWindow();
  });
});

// Nothing else is watching this. Without the catch, anything that throws before the
// window opens leaves the app running with no window and no clue why.
boot.catch((e: unknown) => {
  console.error("Vault failed to start:", e);
  dialog.showErrorBox("Vault couldn't start", e instanceof Error ? e.message : String(e));
  app.exit(1);
});

app.on("window-all-closed", () => {
  // Stay running on macOS so the global capture hotkey keeps working with no window
  // open; the dock icon reopens the vault. Other platforms quit as usual.
  if (!IS_MAC) app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  fire(session.closeVault(), "closing the vault");
});

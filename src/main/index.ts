import { app, globalShortcut, nativeTheme } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { APP_ID } from "@shared/constants";
import { registerIpcHandlers } from "./app/ipc/ipc";
import { registerHotkey } from "./app/hotkey/hotkey";
import { buildAppMenu } from "./app/menu/menu";
import { registerAssetProtocol, registerAssetScheme } from "./app/protocol/protocol";
import { session } from "./app/session/session";
import { createTray, updateTray } from "./app/tray/tray";
import { configureNetwork } from "./network/axios";
import { getSettings } from "./store/settings.store";
import { loadToken } from "./store/token.store";
import {
  editorWindowCount,
  getCaptureWindow,
  getMainWindow,
  IS_MAC,
  openMainWindow,
} from "./windows";

if (!app.requestSingleInstanceLock()) app.quit();

registerAssetScheme();

app.on("second-instance", () => openMainWindow());

app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID);
  nativeTheme.themeSource = "light";
  app.on("browser-window-created", (_, w) => optimizer.watchWindowShortcuts(w));

  configureNetwork({ getToken: loadToken, onAuthExpired: () => void session.revalidate() });
  registerIpcHandlers();
  registerAssetProtocol();
  await session.restore();
  createTray();
  session.vault?.on("sync", updateTray);

  const settings = getSettings();
  buildAppMenu(settings.vault?.hotkey);
  if (settings.vault && session.vault) registerHotkey(settings.vault.hotkey);
  getCaptureWindow(); // pre-warm so the sheet appears instantly
  openMainWindow(settings.onboarded && session.vault ? "main" : "onboarding");

  app.on("activate", () => {
    if (!getMainWindow() && editorWindowCount() === 0) openMainWindow();
  });
});

app.on("window-all-closed", () => {
  // Stay alive in the menu bar for the global hotkey on macOS.
  if (!IS_MAC) app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void session.closeVault();
});

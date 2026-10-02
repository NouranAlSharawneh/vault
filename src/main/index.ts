import { existsSync } from "node:fs";
import { join } from "node:path";
import { electronApp, optimizer } from "@electron-toolkit/utils";
import { app, dialog, globalShortcut, nativeTheme } from "electron";
import { APP_ID, PASTED_DIR } from "@shared/constants";
import { attachContextMenu } from "./app/context-menu/context-menu";
import { registerHotkey } from "./app/hotkey/hotkey";
import { registerIpcHandlers } from "./app/ipc/ipc";
import { openedAtLogin } from "./app/login-item/login-item";
import { buildAppMenu } from "./app/menu/menu";
import { isMarkdownFile, openMarkdownFile } from "./app/open-file/open-file";
import { registerAssetProtocol, registerAssetScheme } from "./app/protocol/protocol";
import { showMainWindow } from "./app/session/launch-route";
import { session } from "./app/session/session";
import { watchForReconnect } from "./app/session/sync-watch";
import { createTray, destroyTray } from "./app/tray/tray";
import { stopWatchingForUpdates, watchForUpdates } from "./app/updates/update-watch";
import { fire } from "./lib/fire";
import { configureNetwork } from "./network/axios";
import { pruneStaged, setStagingDir } from "./services/assets";
import { getSettings } from "./store/settings.store";
import { loadToken } from "./store/token.store";
import { userDataDir } from "./store/user-data-dir";
import { getCaptureWindow, getMainWindow, hardenWebContents, IS_MAC } from "./windows";

// The second launch hands over to the first and stops here. `quit()` alone let the rest of
// this file run on: handlers registered, and the session restored against the same vault.
if (!app.requestSingleInstanceLock()) app.exit(0);

registerAssetScheme();

/**
 * A markdown file handed over from outside — Finder's "Open With", a double-click once
 * Marasca is the default, a path on the command line — opened in an editor once the
 * session is up. One that can't be opened says why; failing silently looked like a hang.
 */
function openFromOutside(path: string): void {
  fire(
    boot
      .then(() => openMarkdownFile(path))
      .catch((e: unknown) =>
        dialog.showMessageBox({
          type: "warning",
          message: "Marasca couldn't open that file",
          detail: e instanceof Error ? e.message : String(e),
        }),
      ),
    "opening a file from outside",
  );
}

/** Markdown files among launch arguments (Windows and Linux pass opened files this way). */
const filesIn = (argv: string[]) => argv.slice(1).filter((a) => isMarkdownFile(a) && existsSync(a));

// macOS sends files as events, and may do so before the app is ready; registered here,
// before anything is awaited, so none is missed.
app.on("open-file", (e, path) => {
  e.preventDefault();
  openFromOutside(path);
});

// A second launch can arrive before this one has restored the session; wait for it, or the
// window would open before the app is ready and on the wrong route.
app.on("second-instance", (_e, argv) => {
  const files = filesIn(argv);
  if (files.length) return files.forEach(openFromOutside);
  fire(boot.then(showMainWindow), "showing the main window");
});

const boot = app.whenReady().then(async () => {
  electronApp.setAppUserModelId(APP_ID);
  nativeTheme.themeSource = "light";
  app.on("browser-window-created", (_, w) => {
    optimizer.watchWindowShortcuts(w);
    hardenWebContents(w.webContents);
    attachContextMenu(w.webContents);
  });

  configureNetwork({
    getToken: loadToken,
    onAuthExpired: () => fire(session.revalidate(), "revalidating the token"),
  });
  registerIpcHandlers();
  registerAssetProtocol();
  // Where images pasted into the editor wait for their document's save; the ones nobody
  // saved are cleared out after a month.
  setStagingDir(join(userDataDir(), PASTED_DIR));
  fire(pruneStaged(), "clearing out old pasted images");
  await session.restore();

  const settings = getSettings();
  buildAppMenu(settings.vault?.hotkey);
  if (settings.vault && session.vault) registerHotkey(settings.vault.hotkey);
  getCaptureWindow(); // pre-warm so the sheet appears instantly
  createTray();
  watchForReconnect();
  watchForUpdates();
  // Started by the login item: no window. The menu bar item and the shortcut are there.
  if (!openedAtLogin()) showMainWindow();
  if (!IS_MAC) filesIn(process.argv).forEach(openFromOutside);

  // The dock icon brings the vault back even when only editor windows are open.
  app.on("activate", () => {
    if (!getMainWindow()) showMainWindow();
  });
});

// Nothing else is watching this. Without the catch, anything that throws before the
// window opens leaves the app running with no window and no clue why.
boot.catch((e: unknown) => {
  console.error("Marasca failed to start:", e);
  dialog.showErrorBox("Marasca couldn't start", e instanceof Error ? e.message : String(e));
  app.exit(1);
});

app.on("window-all-closed", () => {
  // Stay running on macOS so the global capture hotkey keeps working with no window
  // open; the dock icon reopens the vault. Other platforms quit as usual.
  if (!IS_MAC) app.quit();
});

/**
 * Held once, after every window has closed — so an editor that cancelled the quit to ask
 * about unsaved text has had its say — to push what is still waiting and close the vault
 * properly. Firing the close and letting the process go cut both off mid-way.
 */
let shutDown = false;
app.on("will-quit", (e) => {
  globalShortcut.unregisterAll();
  // The menu bar item goes with the app; one left behind answers nothing.
  destroyTray();
  stopWatchingForUpdates();
  if (shutDown) return;
  shutDown = true;
  e.preventDefault();
  fire(
    session.shutdown().finally(() => app.quit()),
    "closing the vault",
  );
});

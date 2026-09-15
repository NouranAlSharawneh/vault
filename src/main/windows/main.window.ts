import { BrowserWindow, shell } from "electron";
import { MAIN_WINDOW, PAPER_BG, TRAFFIC_LIGHTS } from "@shared/constants";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

let mainWin: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null;
}

export function openMainWindow(route = "main"): BrowserWindow {
  const existing = getMainWindow();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    existing.webContents.send("navigate", route);

    return existing;
  }
  mainWin = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    ...MAIN_WINDOW,
    title: "Vault",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: PAPER_BG,
    vibrancy: IS_MAC ? "sidebar" : undefined,
  });
  mainWin.once("ready-to-show", () => mainWin?.show());
  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);

    return { action: "deny" };
  });
  mainWin.on("closed", () => (mainWin = null));
  loadRoute(mainWin, route);

  return mainWin;
}

/** Bring the main window forward with one document selected. */
export function revealDoc(path: string): void {
  const win = openMainWindow();
  const send = () => win.webContents.send("doc:reveal", path);
  if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send);
  else send();
}

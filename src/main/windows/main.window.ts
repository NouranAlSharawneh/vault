import { BrowserWindow, shell } from "electron";
import { MAIN_WINDOW, PAPER_BG, TRAFFIC_LIGHTS } from "@shared/constants";
import type { DocReveal, SavedNotice } from "@shared/types";
import { fire } from "../lib/fire";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

let mainWin: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null;
}

/**
 * Show the main window, creating it on `route` (default Main) if there is none. An open
 * window only navigates when a route is asked for; without one it is just brought forward,
 * so whatever you were in the middle of is still there.
 */
export function openMainWindow(route?: string): BrowserWindow {
  const existing = getMainWindow();
  if (existing) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    if (route !== undefined) existing.webContents.send("navigate", route);

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
    fire(shell.openExternal(url), "opening a link");

    return { action: "deny" };
  });
  mainWin.on("closed", () => (mainWin = null));
  loadRoute(mainWin, route ?? "main");

  return mainWin;
}

/** Bring the main window forward with one document selected. */
export function revealDoc(path: string, saved?: SavedNotice): void {
  const win = openMainWindow("main");
  const reveal: DocReveal = saved ? { path, saved } : { path };
  const send = () => win.webContents.send("doc:reveal", reveal);
  if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send);
  else send();
}

import { BrowserWindow, shell } from "electron";
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
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: "Vault",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: "#fdfcfa",
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

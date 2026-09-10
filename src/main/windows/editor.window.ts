import { BrowserWindow } from "electron";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

const editorWins = new Set<BrowserWindow>();

export function editorWindowCount(): number {
  return editorWins.size;
}

export function openEditorWindow(query = ""): BrowserWindow {
  const win = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    title: "New document — Vault",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 16 },
    backgroundColor: "#fdfcfa",
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => editorWins.delete(win));
  editorWins.add(win);
  loadRoute(win, `editor${query}`);
  return win;
}

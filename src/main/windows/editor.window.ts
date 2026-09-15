import { BrowserWindow } from "electron";
import { EDITOR_WINDOW, PAPER_BG, TRAFFIC_LIGHTS } from "@shared/constants";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

const editorWins = new Set<BrowserWindow>();

export function editorWindowCount(): number {
  return editorWins.size;
}

export function openEditorWindow(query = ""): BrowserWindow {
  const win = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    ...EDITOR_WINDOW,
    title: "New document — Vault",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: PAPER_BG,
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => editorWins.delete(win));
  editorWins.add(win);
  loadRoute(win, `editor${query}`);

  return win;
}

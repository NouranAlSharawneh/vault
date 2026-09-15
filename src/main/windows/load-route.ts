import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import type { BrowserWindow } from "electron";

export const PRELOAD_PATH = join(__dirname, "../preload/index.js");
export const IS_MAC = process.platform === "darwin";

export const COMMON_WINDOW_OPTIONS: Electron.BrowserWindowConstructorOptions = {
  show: false,
  webPreferences: {
    preload: PRELOAD_PATH,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: true,
  },
};

/** Point a window at a renderer route (hash-based). */
export function loadRoute(win: BrowserWindow, hash: string): void {
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), { hash });
  }
}

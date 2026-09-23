import { BrowserWindow, type WebContents } from "electron";
import { EDITOR_WINDOW, PAPER_BG, TRAFFIC_LIGHTS } from "@shared/constants";
import type { EditorDraft } from "@shared/types";
import { createEditorRegistry } from "./editor-registry";
import type { EditorTarget } from "./editor-registry.types";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

const editors = createEditorRegistry<BrowserWindow>();

export function editorWindowCount(): number {
  return editors.size();
}

/** A document named in the hash, or text from the capture sheet the window asks for. */
export function openEditorWindow({ path, draft }: EditorTarget = {}): BrowserWindow {
  const win = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    ...EDITOR_WINDOW,
    title: "New document — Vault",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: PAPER_BG,
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => editors.remove(win));
  editors.add(win, { seed: draft ?? null });
  loadRoute(win, `editor${path ? `?path=${encodeURIComponent(path)}` : ""}`);

  return win;
}

/**
 * The text this editor window was opened with, handed over once. It used to be pushed
 * on did-finish-load, which fires before the editor has booted and subscribed, so the
 * capture sheet's text often never arrived.
 */
export function takeEditorSeed(sender: WebContents): EditorDraft | null {
  const win = BrowserWindow.fromWebContents(sender);

  return win ? editors.takeSeed(win) : null;
}

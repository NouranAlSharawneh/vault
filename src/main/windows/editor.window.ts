import { BrowserWindow } from "electron";
import { EDITOR_WINDOW, PAPER_BG, TRAFFIC_LIGHTS } from "@shared/constants";
import type { EditorDraft } from "@shared/types";
import { findOrphanedUntitledDraft, newUntitledDraftKey } from "../store/draft.store";
import { createEditorRegistry } from "./editor-registry";
import type { EditorTarget } from "./editor-registry.types";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";

const editors = createEditorRegistry<BrowserWindow>();

export function editorWindowCount(): number {
  return editors.size();
}

/**
 * Where a new untitled window parks its text. Every one used to share "new", so a second
 * window opened with the first one's text, and saving either one cleared the other's.
 *
 * Text left behind by a crash or a quit that no open window is still writing comes back
 * in the next one. A window opened with text of its own starts clean, so that text is
 * never parked on top of it.
 */
function untitledDraftKey(seeded: boolean): string {
  if (seeded) return newUntitledDraftKey();
  try {
    return findOrphanedUntitledDraft(editors.heldDraftKeys()) ?? newUntitledDraftKey();
  } catch {
    return newUntitledDraftKey();
  }
}

/**
 * A document, or an untitled window with its own draft key. Both travel in the hash, so
 * a reload opens the same thing; text from the capture sheet is asked for separately.
 */
export function openEditorWindow({ path, draft }: EditorTarget = {}): BrowserWindow {
  // A document already open is brought forward, never opened a second time.
  const open = path ? editors.windowFor(path) : null;
  if (open && !open.isDestroyed()) {
    if (open.isMinimized()) open.restore();
    open.show();
    open.focus();

    return open;
  }
  const draftKey = path ? null : untitledDraftKey(!!draft);
  const query: Record<string, string> = draftKey ? { draft: draftKey } : { path: path ?? "" };
  const win = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    ...EDITOR_WINDOW,
    title: "New document — Marasca",
    titleBarStyle: IS_MAC ? "hiddenInset" : "default",
    trafficLightPosition: TRAFFIC_LIGHTS,
    backgroundColor: PAPER_BG,
  });
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => editors.remove(win));
  editors.add(win, { path: path ?? null, draftKey, seed: draft ?? null });
  loadRoute(win, `editor?${new URLSearchParams(query).toString()}`);

  return win;
}

/**
 * The text this editor window was opened with, handed over once. It used to be pushed
 * on did-finish-load, which fires before the editor has booted and subscribed, so the
 * capture sheet's text often never arrived.
 */
export function takeEditorSeed(win: BrowserWindow | null): EditorDraft | null {
  return win ? editors.takeSeed(win) : null;
}

/** The asking window's document moved: its first save, or a save that renamed it. */
export function setEditorPath(win: BrowserWindow | null, path: string | null): void {
  if (win) editors.setPath(win, path);
}

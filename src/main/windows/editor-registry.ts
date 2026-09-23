import type { EditorDraft } from "@shared/types";
import type { EditorEntry } from "./editor-registry.types";

/**
 * The open editor windows and what each one holds. Kept free of Electron so it can be
 * tested on its own; `W` is a BrowserWindow in the app.
 */
export function createEditorRegistry<W>() {
  const entries = new Map<W, EditorEntry>();

  return {
    add(win: W, entry: EditorEntry): void {
      entries.set(win, { ...entry });
    },
    remove(win: W): void {
      entries.delete(win);
    },
    size(): number {
      return entries.size;
    },
    /** The window's starting text, once: after a reload its parked draft is newer. */
    takeSeed(win: W): EditorDraft | null {
      const entry = entries.get(win);
      const seed = entry?.seed ?? null;
      if (entry) entry.seed = null;

      return seed;
    },
  };
}

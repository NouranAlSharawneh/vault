import type { EditorDraft } from "@shared/types";
import type { EditorEntry } from "./editor-registry.types";

/**
 * The open editor windows and what each one holds. Kept free of Electron so it can be
 * tested on its own; `W` is a BrowserWindow in the app.
 *
 * Opening a document always made a new window, so the same file could be open in two
 * editors at once, and whichever saved second wrote over the other.
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
    /** The window already holding this document, if any. */
    windowFor(path: string): W | null {
      for (const [win, entry] of entries) if (entry.path === path) return win;

      return null;
    },
    /** A new document's first save, or a save that moved it, gives it a new path. */
    setPath(win: W, path: string | null): void {
      const entry = entries.get(win);
      if (entry) entry.path = path;
    },
    /** Untitled drafts an open window is still writing to, so none is handed out twice. */
    heldDraftKeys(): Set<string> {
      const held = new Set<string>();
      for (const { draftKey } of entries.values()) if (draftKey) held.add(draftKey);

      return held;
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

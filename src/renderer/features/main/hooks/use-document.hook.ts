import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { TRASH_DIR } from "@shared/constants";
import type { DocContent, DocMeta } from "@shared/types";
import type { LoadedDocument } from "../main.types";

export interface DocumentState {
  /** The selected document, once it has loaded. */
  doc: DocContent | null;
  /**
   * The document shown before, kept on screen while the next one loads. The reader used
   * to fall back to "Select a document" between every two clicks and flicker.
   */
  previous: DocContent | null;
  /** Why the selected document couldn't be read. */
  error: string | null;
  retry: () => void;
}

/**
 * Loads a document's body whenever the selected path changes, and again whenever the
 * index says the file itself changed (its mtime moved) — an editor save, a restore from
 * history, a pull. Keyed on the path alone, an edit you had just saved stayed hidden
 * behind the old text until you clicked away and back. Metadata is taken from
 * the live index when available so star/tag changes show without a reload. Paths under
 * `.trash/` are read straight from disk since the index skips that folder.
 */
export function useDocument(path: string | null, live?: DocMeta[]): DocumentState {
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const [attempt, setAttempt] = useState(0);
  const revision = live?.find((d) => d.path === path)?.mtime;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api(isTrashed(path) ? "trash:read" : "doc:read", path)
      .then((doc) => !cancelled && setLoaded({ path, doc, error: null }))
      .catch((e: unknown) => !cancelled && setLoaded({ path, doc: null, error: errorMessage(e) }));

    return () => {
      cancelled = true;
    };
  }, [path, revision, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = !!path && loaded?.path === path ? loaded : null;
  const fresh = current?.doc ? live?.find((d) => d.path === path) : undefined;
  const doc = current?.doc ? (fresh ? { ...current.doc, meta: fresh } : current.doc) : null;

  return {
    doc,
    // Until the new one lands, `loaded` still holds whatever was read last.
    previous: path && !current ? (loaded?.doc ?? null) : null,
    error: current?.error ?? null,
    retry,
  };
}

export function isTrashed(path: string | null): boolean {
  return !!path && path.startsWith(`${TRASH_DIR}/`);
}

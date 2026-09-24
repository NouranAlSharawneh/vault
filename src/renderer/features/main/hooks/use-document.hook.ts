import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TRASH_DIR } from "@shared/constants";
import type { DocContent, DocMeta } from "@shared/types";
import type { LoadedDocument } from "../main.types";

/**
 * Loads a document's body whenever the selected path changes, and again whenever the
 * index says the file itself changed (its mtime moved) — an editor save, a restore from
 * history, a pull. Keyed on the path alone, an edit you had just saved stayed hidden
 * behind the old text until you clicked away and back. Metadata is taken from
 * the live index when available so star/tag changes show without a reload. Paths under
 * `.trash/` are read straight from disk since the index skips that folder.
 */
export function useDocument(path: string | null, live?: DocMeta[]): DocContent | null {
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);
  const revision = live?.find((d) => d.path === path)?.mtime;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api(isTrashed(path) ? "trash:read" : "doc:read", path)
      .then((doc) => !cancelled && setLoaded({ path, doc }))
      .catch(() => !cancelled && setLoaded({ path, doc: null }));

    return () => {
      cancelled = true;
    };
  }, [path, revision]);

  if (!path || loaded?.path !== path || !loaded.doc) return null;
  const fresh = live?.find((d) => d.path === path);

  return fresh ? { ...loaded.doc, meta: fresh } : loaded.doc;
}

export function isTrashed(path: string | null): boolean {
  return !!path && path.startsWith(`${TRASH_DIR}/`);
}

import { useEffect, useState } from "react";
import { TRASH_DIR } from "@shared/constants";
import type { DocContent, DocMeta } from "@shared/types";
import { api } from "@/lib/api";
import type { LoadedDocument } from "../main.types";

/**
 * Loads a document's body whenever the selected path changes. Metadata is taken from
 * the live index when available so star/tag changes show without a reload. Paths under
 * `.trash/` are read straight from disk since the index skips that folder.
 */
export function useDocument(path: string | null, live?: DocMeta[]): DocContent | null {
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api(isTrashed(path) ? "trash:read" : "doc:read", path)
      .then((doc) => !cancelled && setLoaded({ path, doc }))
      .catch(() => !cancelled && setLoaded({ path, doc: null }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path || loaded?.path !== path || !loaded.doc) return null;
  const fresh = live?.find((d) => d.path === path);
  return fresh ? { ...loaded.doc, meta: fresh } : loaded.doc;
}

export function isTrashed(path: string | null): boolean {
  return !!path && path.startsWith(`${TRASH_DIR}/`);
}

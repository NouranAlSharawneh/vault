import { useEffect, useState } from "react";
import type { DocContent } from "@shared/types";
import { api } from "@/lib/api";
import type { LoadedDocument } from "../main.types";

/** Loads a document's body whenever the selected path changes. */
export function useDocument(path: string | null): DocContent | null {
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api("doc:read", path)
      .then((doc) => !cancelled && setLoaded({ path, doc }))
      .catch(() => !cancelled && setLoaded({ path, doc: null }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  return path && loaded?.path === path ? loaded.doc : null;
}

import { useEffect } from "react";
import type { DocContent, EditorDraft } from "@shared/types";
import { api, on } from "@/lib/api";

interface Handlers {
  onDoc: (doc: DocContent) => void;
  onDraft: (draft: EditorDraft) => void;
}

/** Opens whatever main asked for: `?path=` in the hash, or an `editor:open` event. */
export function useEditorOpen({ onDoc, onDraft }: Handlers) {
  useEffect(() => {
    const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const path = query.get("path");
    if (path)
      api("doc:read", path)
        .then(onDoc)
        .catch(() => undefined);
    return on("editor:open", (payload) => {
      if (payload.path)
        api("doc:read", payload.path)
          .then(onDoc)
          .catch(() => undefined);
      else if (payload.draft) onDraft(payload.draft);
    });
  }, [onDoc, onDraft]);
}

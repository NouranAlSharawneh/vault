import { useEffect, useRef } from "react";
import type { DocContent, EditorDraft } from "@shared/types";
import { api, on } from "@/lib/api";

interface Handlers {
  onDoc: (doc: DocContent) => void;
  onDraft: (draft: EditorDraft) => void;
}

/** Opens whatever main asked for: `?path=` in the hash, or an `editor:open` event. */
export function useEditorOpen({ onDoc, onDraft }: Handlers) {
  /**
   * Kept in a ref so neither effect below depends on a callback's identity.
   *
   * Both are rebuilt whenever the config changes, and the config changes from inside this
   * very window — picking a folder in the image panel writes it. The load effect used to
   * depend on them, so that click re-read the file from disk and replaced everything the
   * user had typed, with no prompt and the unsaved guard disarmed.
   */
  const handlers = useRef<Handlers>({ onDoc, onDraft });
  useEffect(() => {
    handlers.current = { onDoc, onDraft };
  });

  const read = (path: string): void => {
    void api("doc:read", path)
      .then((doc) => handlers.current.onDoc(doc))
      .catch(() => undefined);
  };

  // The document named in the hash is read once, when the window opens, and never again.
  useEffect(() => {
    const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const path = query.get("path");
    if (path) read(path);
  }, []);

  useEffect(
    () =>
      on("editor:open", (payload) => {
        if (payload.path) read(payload.path);
        else if (payload.draft) handlers.current.onDraft(payload.draft);
      }),
    [],
  );
}

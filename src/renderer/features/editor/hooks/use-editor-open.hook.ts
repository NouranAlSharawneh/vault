import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/helpers";
import { api, fire } from "@/lib/api";
import type { DocContent, EditorDraft } from "@shared/types";
import type { EditorTarget, OpenStatus } from "../editor.types";

interface Handlers {
  onDoc: (doc: DocContent) => void;
  onDraft: (draft: EditorDraft) => void;
  /** Bring back text left unsaved the last time this document was open. */
  onRecover: (key: string) => Promise<void>;
}

const READY: OpenStatus = { kind: "ready" };

/** What main opened this window on: `?path=` in the hash, or nothing for a new document. */
export function readEditorTarget(): EditorTarget {
  const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");

  return { path: query.get("path") };
}

/**
 * One step after another. The file and the parked draft used to be asked for at once;
 * the draft usually answered first, then the file landed on top of it, marked the
 * document clean and threw the recovered text away.
 */
async function open(target: EditorTarget, handlers: { current: Handlers }): Promise<OpenStatus> {
  if (target.path) {
    let doc: DocContent;
    try {
      doc = await api("doc:read", target.path);
    } catch (e) {
      // Not "New document": saving that wrote a second copy beside the file that failed.
      return { kind: "failed", path: target.path, reason: errorMessage(e), retrying: false };
    }
    handlers.current.onDoc(doc);
    await handlers.current.onRecover(target.path);

    return READY;
  }
  // Text from the capture sheet is asked for, not waited for: main used to push it on
  // did-finish-load, before this window had booted far enough to be listening.
  const seed = await api("editor:seed").catch(() => null);
  if (seed) handlers.current.onDraft(seed);
  // A new document has no file to read, but it may still have unsaved text parked.
  else await handlers.current.onRecover("new");

  return READY;
}

/** Opens whatever main asked for, once, when the window opens; and again on Try again. */
export function useEditorOpen(target: EditorTarget, { onDoc, onDraft, onRecover }: Handlers) {
  /**
   * Kept in a ref so the open below does not depend on a callback's identity.
   *
   * They are rebuilt whenever the config changes, and the config changes from inside this
   * very window — picking a folder in the image panel writes it. The load used to depend
   * on them, so that click re-read the file from disk and replaced everything the user
   * had typed, with no prompt and the unsaved guard disarmed.
   */
  const handlers = useRef<Handlers>({ onDoc, onDraft, onRecover });
  useEffect(() => {
    handlers.current = { onDoc, onDraft, onRecover };
  });
  const [status, setStatus] = useState<OpenStatus>({ kind: "opening" });

  const run = useCallback(() => {
    const opening = open(target, handlers)
      // Only a document that failed to read blocks saving; a new one opens regardless.
      .catch((e: unknown): OpenStatus => {
        if (!target.path) return READY;

        return { kind: "failed", path: target.path, reason: errorMessage(e), retrying: false };
      })
      .then(setStatus);
    fire(opening, "Couldn’t open the document");
  }, [target]);

  // Once per window, StrictMode's second effect run included: the capture sheet's text is
  // handed over only once, and a second read would land on top of the first.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  const retry = useCallback(() => {
    setStatus((s) => (s.kind === "failed" ? { ...s, retrying: true } : s));
    run();
  }, [run]);

  return { status, retry };
}

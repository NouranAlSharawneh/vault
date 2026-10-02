import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NOTHING_TO_SAVE } from "@/data/editor.data";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { DRAFT_DEBOUNCE_MS } from "@shared/constants";
import { inferTitle } from "@shared/helpers";
import type {
  AssetImport,
  DocContent,
  EditorDraft,
  SaveResult,
  Source,
  StoredDraft,
} from "@shared/types";
import {
  emptyMeta,
  metaFromDoc,
  type DraftMeta,
  type DraftState,
  type SaveMode,
} from "../editor.types";

/**
 * The document being edited: fields, dirtiness, inferred title, path preview, save.
 * `untitledKey` is where its text is parked until it has a path; null while a document
 * is still being read.
 */
export function useEditorDraft(untitledKey: string | null) {
  const config = useApp((s) => s.config);
  const defaultSource: Source = config?.lastSource ?? "claude";
  const [state, setState] = useState<DraftState>({
    body: "",
    meta: emptyMeta(defaultSource),
    existingPath: null,
    created: null,
    dirty: false,
    sourcePath: null,
    baseMtime: null,
    baseHash: null,
  });
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<SaveResult | null>(null);
  /**
   * Text parked from an earlier session that is older than the file: the file moved on
   * since (a pull, an edit elsewhere), so the draft is offered rather than put back —
   * applied silently, the next save wrote over the newer file without a word.
   */
  const [staleDraft, setStaleDraft] = useState<StoredDraft | null>(null);
  const [pathPreview, setPathPreview] = useState("");

  const inferredTitle = useMemo(() => inferTitle(state.body) ?? "", [state.body]);
  const effectiveTitle = state.meta.title.trim() || inferredTitle;

  useEffect(() => {
    api(
      "doc:pathPreview",
      state.meta.project,
      effectiveTitle || "untitled",
      state.existingPath ?? undefined,
    )
      .then(setPathPreview)
      .catch(() => undefined);
  }, [state.meta.project, effectiveTitle, state.existingPath]);

  // The same text again is not an edit.
  const setBody = useCallback(
    (body: string) => setState((s) => (s.body === body ? s : { ...s, body, dirty: true })),
    [],
  );
  const setMeta = useCallback(
    (patch: Partial<DraftMeta>) =>
      setState((s) => ({ ...s, meta: { ...s.meta, ...patch }, dirty: true })),
    [],
  );

  /** Load an existing document into the editor. */
  const loadDoc = useCallback((doc: DocContent) => {
    setState({
      body: doc.body,
      meta: metaFromDoc(doc.meta),
      existingPath: doc.meta.path,
      created: doc.meta.created,
      dirty: false,
      sourcePath: null,
      baseMtime: doc.meta.mtime,
      baseHash: doc.hash ?? null,
    });
    setLastSaved(null);
  }, []);

  /** Seed a new document (from the capture sheet or clipboard). */
  const loadDraft = useCallback(
    (draft: EditorDraft) => {
      const fm = draft.frontmatter ?? {};
      setState({
        body: draft.body,
        meta: {
          title: fm.title ?? "",
          project: fm.project ?? config?.lastProject ?? "",
          tags: fm.tags ?? [],
          source: fm.source ?? defaultSource,
          starred: !!fm.starred,
        },
        existingPath: null,
        created: null,
        dirty: draft.body.length > 0,
        sourcePath: draft.sourcePath ?? null,
        // A seeded draft is not a file on disk yet, so there is nothing to be newer than.
        baseMtime: null,
        baseHash: null,
      });
    },
    [config?.lastProject, defaultSource],
  );

  /**
   * Park the text outside the vault while it is unsaved, and pick it up again next time
   * this document is opened. Before this, closing the window, quitting or a crash lost it,
   * and Discard in the unsaved prompt was instant and final.
   */
  const draftKey = state.existingPath ?? untitledKey;
  useEffect(() => {
    if (!state.dirty || !draftKey) return;
    const t = setTimeout(() => {
      void api("draft:save", draftKey, {
        body: state.body,
        meta: state.meta,
        at: new Date().toISOString(),
      }).catch(() => undefined);
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [draftKey, state.body, state.meta, state.dirty]);

  /**
   * Bring back whatever was left behind for this document, if it is still unsaved. `doc`
   * is the file it was opened on, when there is one.
   */
  const recoverDraft = useCallback(async (key: string, doc?: DocContent) => {
    const parked = await api("draft:load", key).catch(() => null);
    if (!parked?.body.trim()) return;
    // The same text as the file is nothing to recover.
    if (doc && parked.body === doc.body) return;
    // Older than the file on disk: ask, don't apply.
    if (doc && Date.parse(parked.at) < doc.meta.mtime) {
      setStaleDraft(parked);

      return;
    }
    setState((s) =>
      // Only if nothing has been typed since the window opened — never overwrite live work.
      s.dirty ? s : { ...s, body: parked.body, meta: { ...s.meta, ...parked.meta }, dirty: true },
    );
  }, []);

  /** Put the offered draft back after all, or let it go. */
  const resolveStaleDraft = useCallback(
    (restore: boolean) => {
      const parked = staleDraft;
      setStaleDraft(null);
      if (!parked) return;
      if (restore)
        setState((s) => ({
          ...s,
          body: parked.body,
          meta: { ...s.meta, ...parked.meta },
          dirty: true,
        }));
      else if (draftKey) void api("draft:clear", draftKey).catch(() => undefined);
    },
    [staleDraft, draftKey],
  );

  /**
   * One save at a time. ⌘↵ reaches the editor twice for one press — CodeMirror's own
   * Mod-Enter and the menu accelerator — and both calls saw no path yet, so a new
   * document was written out as two files. `saving` is state and lags a render behind.
   */
  const inFlight = useRef(false);
  const save = useCallback(
    async (mode: SaveMode, assets?: AssetImport) => {
      if (inFlight.current) return null;
      if (!state.body.trim()) {
        // Say so: from the unsaved prompt this used to be a Save button that did nothing.
        setError(NOTHING_TO_SAVE);

        return null;
      }
      inFlight.current = true;
      setSaving(mode);
      setError(null);
      const sent = { body: state.body, meta: state.meta };
      try {
        const res = await api("doc:save", {
          body: sent.body,
          frontmatter: {
            ...sent.meta,
            title: effectiveTitle,
            created: state.created ?? undefined,
          },
          existingPath: state.existingPath ?? undefined,
          baseMtime: state.baseMtime ?? undefined,
          baseHash: state.baseHash ?? undefined,
          commit: mode === "commit",
          assets,
        });
        setState((s) => ({
          ...s,
          // Links the save rewrote (a pasted image now in `assets/`) come back with it, as
          // long as nothing was typed meanwhile — the text is read-only while a save is out.
          body: res.body !== undefined && s.body === sent.body ? res.body : s.body,
          // Where the file is now, even when the commit after it failed: a retry has to
          // carry on from here, not write a second copy or move it from where it was.
          existingPath: res.path,
          created: res.meta.created,
          meta: { ...s.meta, title: res.meta.title },
          // Still dirty if anything changed while the save was out, or it didn't commit.
          dirty: !!res.commitError || s.body !== sent.body || s.meta !== sent.meta,
          // The file on disk is ours again as of this write.
          baseMtime: res.meta.mtime,
          baseHash: res.hash ?? null,
        }));
        if (res.commitError) {
          setError(`Saved to disk, but the commit failed: ${res.commitError}`);

          return null;
        }
        setLastSaved(res);
        // Saved text is not a draft any more, under either key it might have had.
        if (draftKey) void api("draft:clear", draftKey).catch(() => undefined);
        if (res.path !== draftKey) void api("draft:clear", res.path).catch(() => undefined);

        return res;
      } catch (e) {
        setError(errorMessage(e));

        return null;
      } finally {
        inFlight.current = false;
        setSaving(null);
      }
    },
    [state, effectiveTitle, draftKey],
  );

  return {
    ...state,
    inferredTitle,
    effectiveTitle,
    pathPreview,
    saving,
    error,
    lastSaved,
    canSave: state.body.trim().length > 0 && !saving,
    setBody,
    setMeta,
    loadDoc,
    loadDraft,
    recoverDraft,
    staleDraft,
    resolveStaleDraft,
    discardDraft: useCallback(() => {
      if (draftKey) void api("draft:clear", draftKey).catch(() => undefined);
    }, [draftKey]),
    save,
  };
}

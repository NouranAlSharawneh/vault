import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import { DRAFT_DEBOUNCE_MS } from "@shared/constants";
import { inferTitle } from "@shared/helpers";
import type { AssetImport, DocContent, EditorDraft, SaveResult, Source } from "@shared/types";
import {
  emptyMeta,
  metaFromDoc,
  type DraftMeta,
  type DraftState,
  type SaveMode,
} from "../editor.types";

/** The document being edited: fields, dirtiness, inferred title, path preview, save. */
export function useEditorDraft() {
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
  });
  const [saving, setSaving] = useState<SaveMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<SaveResult | null>(null);
  const [pathPreview, setPathPreview] = useState("");

  const inferredTitle = useMemo(() => inferTitle(state.body) ?? "", [state.body]);
  const effectiveTitle = state.meta.title.trim() || inferredTitle;

  useEffect(() => {
    api("doc:pathPreview", state.meta.project, effectiveTitle || "untitled")
      .then(setPathPreview)
      .catch(() => undefined);
  }, [state.meta.project, effectiveTitle]);

  const setBody = useCallback((body: string) => setState((s) => ({ ...s, body, dirty: true })), []);
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
      });
    },
    [config?.lastProject, defaultSource],
  );

  /**
   * Park the text outside the vault while it is unsaved, and pick it up again next time
   * this document is opened. Before this, closing the window, quitting or a crash lost it,
   * and Discard in the unsaved prompt was instant and final.
   */
  const draftKey = state.existingPath ?? "new";
  useEffect(() => {
    if (!state.dirty) return;
    const t = setTimeout(() => {
      void api("draft:save", draftKey, {
        body: state.body,
        meta: state.meta,
        at: new Date().toISOString(),
      }).catch(() => undefined);
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [draftKey, state.body, state.meta, state.dirty]);

  /** Bring back whatever was left behind for this document, if it is still unsaved. */
  const recoverDraft = useCallback(async (key: string) => {
    const parked = await api("draft:load", key).catch(() => null);
    if (!parked?.body.trim()) return;
    setState((s) =>
      // Only if nothing has been typed since the window opened — never overwrite live work.
      s.dirty ? s : { ...s, body: parked.body, meta: { ...s.meta, ...parked.meta }, dirty: true },
    );
  }, []);

  /**
   * One save at a time. ⌘↵ reaches the editor twice for one press — CodeMirror's own
   * Mod-Enter and the menu accelerator — and both calls saw no path yet, so a new
   * document was written out as two files. `saving` is state and lags a render behind.
   */
  const inFlight = useRef(false);
  const save = useCallback(
    async (mode: SaveMode, assets?: AssetImport) => {
      if (!state.body.trim() || inFlight.current) return null;
      inFlight.current = true;
      setSaving(mode);
      setError(null);
      try {
        const res = await api("doc:save", {
          body: state.body,
          frontmatter: {
            ...state.meta,
            title: effectiveTitle,
            created: state.created ?? undefined,
          },
          existingPath: state.existingPath ?? undefined,
          baseMtime: state.baseMtime ?? undefined,
          commit: mode === "commit",
          assets,
        });
        setState((s) => ({
          ...s,
          existingPath: res.path,
          created: res.meta.created,
          meta: { ...s.meta, title: res.meta.title },
          dirty: false,
          // The file on disk is ours again as of this write.
          baseMtime: res.meta.mtime,
        }));
        setLastSaved(res);
        // Saved text is not a draft any more, under either key it might have had.
        void api("draft:clear", draftKey).catch(() => undefined);
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
    discardDraft: useCallback(
      () => void api("draft:clear", draftKey).catch(() => undefined),
      [draftKey],
    ),
    save,
  };
}

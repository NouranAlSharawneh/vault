import { useCallback, useEffect, useMemo, useState } from "react";
import { inferTitle } from "@shared/helpers";
import type { DocContent, EditorDraft, SaveResult, Source } from "@shared/types";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
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
      });
    },
    [config?.lastProject, defaultSource],
  );

  const save = useCallback(
    async (mode: SaveMode) => {
      if (!state.body.trim()) return null;
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
          commit: mode === "commit",
        });
        setState((s) => ({
          ...s,
          existingPath: res.path,
          created: res.meta.created,
          meta: { ...s.meta, title: res.meta.title },
          dirty: false,
        }));
        setLastSaved(res);
        return res;
      } catch (e) {
        setError(errorMessage(e));
        return null;
      } finally {
        setSaving(null);
      }
    },
    [state, effectiveTitle],
  );

  const markClean = useCallback(() => setState((s) => ({ ...s, dirty: false })), []);

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
    save,
    markClean,
  };
}

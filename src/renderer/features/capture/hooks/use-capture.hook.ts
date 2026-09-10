import { useCallback, useEffect, useState } from "react";
import { inferTitle } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
import { useAssetPlan } from "@/components/asset-panel";
import { errorMessage, parentDir } from "@/helpers";
import { api, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { CaptureForm, CaptureState } from "../capture.types";

const EMPTY: CaptureState = {
  clip: null,
  form: { project: "", source: "claude", tags: [] },
  phase: "empty",
  error: null,
  savedPath: null,
  pathPreview: "",
};

/**
 * The ⌃⌥V sheet: main pushes `capture:shown` with the analysed clipboard each
 * time the window appears; project/source are pre-filled from last use + detection.
 */
export function useCapture() {
  const config = useApp((s) => s.config);
  const index = useApp((s) => s.index);
  const [state, setState] = useState<CaptureState>(EMPTY);

  const load = useCallback(
    (clip: ClipboardCapture) => {
      setState({
        ...EMPTY,
        clip,
        phase: clip.text.trim() ? "ready" : "empty",
        form: { project: config?.lastProject ?? "", source: clip.detectedSource, tags: [] },
      });
    },
    [config?.lastProject],
  );

  // First paint may happen before main sends the event; ask once, then follow events.
  useEffect(() => {
    api("capture:readClipboard")
      .then(load)
      .catch(() => undefined);
    return on("capture:shown", load);
  }, [load]);

  const title =
    state.clip?.detectedTitle ?? (state.clip ? (inferTitle(state.clip.text) ?? "Untitled") : "");
  const assets = useAssetPlan({
    body: state.clip?.text ?? "",
    project: state.form.project,
    sourceDir: state.clip?.sourcePath ? parentDir(state.clip.sourcePath) : null,
  });

  useEffect(() => {
    if (!state.clip) return;
    api("doc:pathPreview", state.form.project, title || "untitled")
      .then((p) => setState((s) => ({ ...s, pathPreview: p })))
      .catch(() => undefined);
  }, [state.clip, state.form.project, title]);

  const setForm = (patch: Partial<CaptureForm>) =>
    setState((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const hide = useCallback(() => void api("capture:hide"), []);

  const save = useCallback(async () => {
    if (!state.clip || state.phase !== "ready") return;
    setState((s) => ({ ...s, phase: "saving", error: null }));
    try {
      const res = await api("doc:save", {
        body: state.clip.text,
        frontmatter: {
          title,
          project: state.form.project,
          tags: state.form.tags,
          source: state.form.source,
        },
        commit: true,
        assets: assets.request,
      });
      setState((s) => ({ ...s, phase: "saved", savedPath: res.path }));
      setTimeout(hide, CAPTURE_SAVED_FLASH_MS);
    } catch (e) {
      setState((s) => ({ ...s, phase: "error", error: errorMessage(e) }));
    }
  }, [state.clip, state.phase, state.form, title, hide, assets.request]);

  const openInEditor = useCallback(() => {
    if (!state.clip?.text.trim()) {
      void api("window:openEditor");
      return;
    }
    void api("capture:openEditor", {
      body: state.clip.text,
      sourcePath: state.clip.sourcePath,
      frontmatter: {
        title,
        project: state.form.project,
        tags: state.form.tags,
        source: state.form.source,
      },
    });
  }, [state.clip, state.form, title]);

  const retry = () => setState((s) => ({ ...s, phase: "ready", error: null }));

  return {
    ...state,
    title,
    assets,
    projects: index?.projects.filter((p) => p.slug !== "_inbox").map((p) => p.name) ?? [],
    tags: index?.tags.map((t) => t.tag) ?? [],
    lastProject: config?.lastProject ?? null,
    hasRemote: !!config?.remote,
    setForm,
    save,
    openInEditor,
    hide,
    retry,
  };
}

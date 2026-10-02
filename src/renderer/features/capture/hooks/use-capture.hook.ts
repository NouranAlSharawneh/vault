import { useCallback, useEffect, useRef, useState } from "react";
import { useAssetPlan } from "@/components/asset-panel";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
import { errorMessage, parentDir } from "@/helpers";
import { api, fire, fireQuietly, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import { inferTitle } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";
import type { CaptureForm, CaptureState } from "../capture.types";

const EMPTY: CaptureState = {
  clip: null,
  form: { project: "", source: "claude", tags: [] },
  phase: "loading",
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
  // The "saved" flash that ends in hiding (⌘↵) or revealing (⌥⌘↵). Cancelled if the
  // sheet goes away first, so a blur mid-flash never drags the main window forward.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPending = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
  }, []);

  // Read through a ref: the long-lived sheet must prefill from the latest save, but config
  // arriving must not re-run `load` and wipe a form the user is typing into.
  const lastProject = useRef(config?.lastProject ?? null);
  useEffect(() => {
    lastProject.current = config?.lastProject ?? null;
  }, [config?.lastProject]);

  const load = useCallback((clip: ClipboardCapture) => {
    setState({
      ...EMPTY,
      clip,
      phase: clip.text.trim() ? "ready" : "empty",
      form: { project: lastProject.current ?? "", source: clip.detectedSource, tags: [] },
    });
  }, []);

  // Bumped on every show and hide, so an answer that arrives after the sheet has moved on
  // is dropped instead of painting over the newer state.
  const showing = useRef(0);

  // First paint may happen before main sends the event; ask once, then follow events.
  // Only when the sheet is on screen: it is made hidden at launch, and reading then put
  // whatever was on the clipboard at launch in front of the first ⌃⌥V, ready to be saved.
  useEffect(() => {
    const first = showing.current;
    if (document.visibilityState === "visible")
      api("capture:readClipboard")
        .then((clip) => {
          if (showing.current === first) load(clip);
        })
        .catch(() => undefined);

    const offShown = on("capture:shown", (clip) => {
      const mine = ++showing.current;
      // The sheet outlives many saves, and every save (here or in the editor) moves
      // "last project" on in main. Ask again rather than trusting the copy from boot.
      const refreshed = api("vault:config")
        .then((fresh) => {
          if (!fresh) return;
          lastProject.current = fresh.lastProject ?? null;
          useApp.getState().setConfig(fresh);
        })
        .catch(() => undefined)
        .then(() => {
          if (showing.current === mine) load(clip);
        });
      fireQuietly(refreshed, "filling the sheet");
    });
    const offHidden = on("capture:hidden", () => {
      showing.current++;
      cancelPending();
      // Start the next show blank rather than flashing whatever this one ended on.
      setState(EMPTY);
    });

    return () => {
      offShown();
      offHidden();
      cancelPending();
    };
  }, [load, cancelPending]);

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

  // Esc mid-save would hide a sheet whose save is still landing; it waits.
  const phase = state.phase;
  const hide = useCallback(() => {
    if (phase !== "saving") fireQuietly(api("capture:hide"), "hiding the sheet");
  }, [phase]);

  // The plan as it is now, for a save that waited on it.
  const latestAssets = useRef(assets);
  useEffect(() => {
    latestAssets.current = assets;
  });

  /** ⌘↵ saves and hands focus back to the app you were in; ⌥⌘↵ also opens it in Marasca. */
  const save = useCallback(
    async (reveal = false) => {
      if (!state.clip || (state.phase !== "ready" && state.phase !== "error")) return;
      const clip = state.clip;
      const mine = showing.current;
      setState((s) => ({ ...s, phase: "saving", error: null }));
      // Pressed before the images were looked for: wait for the answer. If some turn out
      // not to travel, stop so the panel can say so — the button then reads "Save anyway".
      if (latestAssets.current.pending) {
        await latestAssets.current.whenSettled();
        if (showing.current !== mine) return;
        if (latestAssets.current.stranded > 0) {
          setState((s) => ({ ...s, phase: "ready" }));

          return;
        }
      }
      try {
        const res = await api("doc:save", {
          body: clip.text,
          frontmatter: {
            title,
            project: state.form.project,
            tags: state.form.tags,
            source: state.form.source,
          },
          commit: true,
          assets: latestAssets.current.request,
        });
        // The sheet was dismissed and shown again while this was saving: the answer
        // belongs to that earlier capture. It used to take over the new one and hide it.
        if (showing.current !== mine) return;
        setState((s) => ({ ...s, phase: "saved", savedPath: res.path }));
        // Flash the committed path, then get out of the way.
        cancelPending();
        pending.current = setTimeout(() => {
          pending.current = null;
          if (reveal)
            fire(api("capture:reveal", res.path), "Saved, but couldn’t open it in the main window");
          else fireQuietly(api("capture:hide"), "hiding the sheet");
        }, CAPTURE_SAVED_FLASH_MS);
      } catch (e) {
        if (showing.current === mine)
          setState((s) => ({ ...s, phase: "error", error: errorMessage(e) }));
      }
    },
    [state.clip, state.phase, state.form, title, cancelPending],
  );

  const openInEditor = useCallback(() => {
    // Through the sheet even when there's nothing to bring: it hides first, rather than
    // floating over the new editor until it lost focus.
    if (!state.clip?.text.trim()) {
      fire(api("capture:openEditor", { body: "" }));

      return;
    }
    fire(
      api("capture:openEditor", {
        body: state.clip.text,
        sourcePath: state.clip.sourcePath,
        frontmatter: {
          title,
          project: state.form.project,
          tags: state.form.tags,
          source: state.form.source,
        },
      }),
    );
  }, [state.clip, state.form, title]);

  /** Try the save again, as it was asked for. */
  const retry = () => fire(save(false));

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

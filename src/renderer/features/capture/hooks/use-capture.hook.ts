import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAssetPlan } from "@/components/asset-panel";
import { CAPTURE_SAVED_FLASH_MS } from "@/constants";
import { errorMessage, parentDir, recentProjects, suggestTags } from "@/helpers";
import { api, fire, fireQuietly, on } from "@/lib/api";
import { useApp } from "@/stores/app";
import { hashText, inferTitle } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";
import type { CaptureForm, CaptureState, ClipVariant } from "../capture.types";

const EMPTY: CaptureState = {
  clip: null,
  form: {
    title: "",
    titleEdited: false,
    project: "",
    source: "claude",
    tags: [],
    variant: "raw",
  },
  phase: "loading",
  error: null,
  savedPath: null,
  pathPreview: "",
};

/** Forms left unsaved, by clip. The sheet is never unmounted, so this lives as long as it. */
const remembered = new Map<string, CaptureForm>();
const REMEMBER_MAX = 20;

/** Which clip this is: the same text (from the same file) is the same clip. */
function clipKey(clip: ClipboardCapture): string {
  return hashText(`${clip.sourcePath ?? ""}\0${clip.text}`);
}

/** Every remembered form goes (for tests; nothing in the app needs to forget them all). */
export function forgetUnsavedCaptures() {
  remembered.clear();
}

function remember(key: string, form: CaptureForm) {
  remembered.delete(key);
  remembered.set(key, form);
  // The oldest go first; a Map keeps insertion order.
  while (remembered.size > REMEMBER_MAX) remembered.delete(remembered.keys().next().value!);
}

/** The text a variant stands for: the conversion, when there is one to stand for. */
function textOf(clip: ClipboardCapture | null, variant: ClipVariant): string {
  if (!clip) return "";

  return variant === "converted" && clip.converted ? clip.converted : clip.text;
}

function titleOf(clip: ClipboardCapture, variant: ClipVariant): string {
  return variant === "converted" && clip.converted
    ? (inferTitle(clip.converted) ?? "")
    : (clip.detectedTitle ?? inferTitle(clip.text) ?? "");
}

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

  // The form as it was filled in, to tell one the user changed from one left alone.
  const fresh = useRef<CaptureForm | null>(null);
  const load = useCallback((clip: ClipboardCapture) => {
    const variant: ClipVariant = clip.converted ? "converted" : "raw";
    const filled: CaptureForm = {
      title: titleOf(clip, variant),
      titleEdited: false,
      project: lastProject.current ?? "",
      source: clip.detectedSource,
      tags: [],
      variant,
    };
    fresh.current = filled;
    // The same clip again after Esc (or the hotkey): the form comes back as it was left.
    const kept = remembered.get(clipKey(clip));
    setState({
      ...EMPTY,
      clip,
      phase: clip.text.trim() ? "ready" : "empty",
      form: kept ?? filled,
    });
  }, []);

  // Bumped on every show and hide, so an answer that arrives after the sheet has moved on
  // is dropped instead of painting over the newer state.
  const showing = useRef(0);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  });

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
      // Esc, a click elsewhere or the hotkey again used to throw away everything chosen.
      // A form the user changed is kept for this clip; one left as filled in is not, so
      // the next show still starts from the latest "last project".
      const s = latest.current;
      if (s.clip && (s.phase === "ready" || s.phase === "error")) {
        const changed = JSON.stringify(s.form) !== JSON.stringify(fresh.current);
        if (changed) remember(clipKey(s.clip), s.form);
        else remembered.delete(clipKey(s.clip));
      }
      // Start the next show blank rather than flashing whatever this one ended on.
      setState(EMPTY);
    });

    return () => {
      offShown();
      offHidden();
      cancelPending();
    };
  }, [load, cancelPending]);

  const text = textOf(state.clip, state.form.variant);
  const title =
    state.form.title.trim() ||
    (state.clip ? titleOf(state.clip, state.form.variant) || "Untitled" : "");
  const assets = useAssetPlan({
    body: text,
    project: state.form.project,
    sourceDir:
      state.clip?.assetDir ?? (state.clip?.sourcePath ? parentDir(state.clip.sourcePath) : null),
  });

  useEffect(() => {
    if (!state.clip) return;
    api("doc:pathPreview", state.form.project, title || "untitled")
      .then((p) => setState((s) => ({ ...s, pathPreview: p })))
      .catch(() => undefined);
  }, [state.clip, state.form.project, title]);

  const setForm = (patch: Partial<CaptureForm>) =>
    setState((s) => ({ ...s, form: { ...s.form, ...patch } }));

  /** A title typed by hand; an empty one goes back to following the text. */
  const setTitle = (value: string) => setForm({ title: value, titleEdited: value.trim() !== "" });

  /** Raw or converted: the title follows, unless it was typed. */
  const setVariant = (variant: ClipVariant) =>
    setState((s) => ({
      ...s,
      form: {
        ...s.form,
        variant,
        title: s.form.titleEdited || !s.clip ? s.form.title : titleOf(s.clip, variant),
      },
    }));

  const recents = useMemo(
    () => recentProjects(index, config?.lastProject ?? null),
    [index, config?.lastProject],
  );
  /** ⌘1–⌘9: the Nth most recent project. */
  const pickProject = (n: number) => {
    const project = recents[n - 1];
    if (project) setForm({ project });
  };

  const suggestedTags = useMemo(
    () => (state.clip ? suggestTags(text, index?.tags ?? [], state.form.tags) : []),
    [state.clip, text, index?.tags, state.form.tags],
  );
  const addTag = (tag: string) =>
    setState((s) =>
      s.form.tags.includes(tag) ? s : { ...s, form: { ...s.form, tags: [...s.form.tags, tag] } },
    );

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
          body: text,
          frontmatter: {
            title,
            project: state.form.project,
            tags: state.form.tags,
            source: state.form.source,
          },
          commit: true,
          assets: latestAssets.current.request,
        });
        remembered.delete(clipKey(clip));
        // The sheet was dismissed and shown again while this was saving: the answer
        // belongs to that earlier capture. It used to take over the new one and hide it.
        if (showing.current !== mine) return;
        // ⌘↵: gone at once, with a notification to say so (and Open, and Undo). Where
        // there are no notifications, the sheet says it itself, as below.
        if (!reveal) {
          const notified = await api("capture:saved", res.path, title).catch(() => false);
          if (notified || showing.current !== mine) return;
        }
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
    [state.clip, state.phase, state.form, text, title, cancelPending],
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
        body: text,
        sourcePath: state.clip.sourcePath,
        frontmatter: {
          title,
          project: state.form.project,
          tags: state.form.tags,
          source: state.form.source,
        },
      }),
    );
  }, [state.clip, state.form, text, title]);

  /** Try the save again, as it was asked for. */
  const retry = () => fire(save(false));

  return {
    ...state,
    text,
    title,
    assets,
    projects: recents,
    recents,
    tags: index?.tags.map((t) => t.tag) ?? [],
    suggestedTags,
    lastProject: config?.lastProject ?? null,
    hasRemote: !!config?.remote,
    setForm,
    setTitle,
    setVariant,
    pickProject,
    addTag,
    save,
    openInEditor,
    hide,
    retry,
  };
}

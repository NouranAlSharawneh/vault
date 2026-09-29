import { useEffect, useRef } from "react";
import { isEditableTarget } from "@/helpers";
import { on } from "@/lib/api";
import type { EditorShortcutHandlers } from "../editor.types";

/**
 * Menu-driven shortcuts (File → Save = ⌘S, Save and Close = ⌘↵) arrive as `shortcut`
 * events; Escape is a plain key listener.
 *
 * Escape inside CodeMirror is left alone. Tab indents there, so CodeMirror's own way out
 * is Escape then Tab — and that only works if the Escape doesn't also close the window.
 * Escape in the title, project or tags field isn't a close either: pressed to clear a
 * field, it used to shut a clean document. ⌘W (the menu's Close) closes from anywhere.
 */
export function useEditorShortcuts(handlers: EditorShortcutHandlers) {
  // The latest handlers, read when a key arrives: depending on them resubscribed both
  // listeners on every keystroke.
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(
    () =>
      on("shortcut", (s) => {
        if (s === "save") latest.current.onSave();
        if (s === "saveClose") latest.current.onSaveClose();
      }),
    [],
  );

  // ⌥⌘P and ⇧⌘O, from anywhere in the window — the text included, which leaves them
  // alone. By `code`: with ⌥ held, macOS turns P into "π".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
      const h = latest.current;
      if (e.altKey && !e.shiftKey && e.code === "KeyP" && h.onFocusMode) {
        e.preventDefault();
        h.onFocusMode();
      } else if (e.shiftKey && !e.altKey && e.code === "KeyO" && h.onOutline) {
        e.preventDefault();
        h.onOutline();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A combobox or tag field dismissing its own list consumes Escape first.
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A dialog (the outline, the shortcuts, the unsaved prompt) closes itself on Escape;
      // this listener was registered first, so it has to stand aside rather than close
      // the window underneath.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (e.target instanceof Element && e.target.closest(".cm-editor")) return;
      if (isEditableTarget(e.target)) return;
      latest.current.onEscape();
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

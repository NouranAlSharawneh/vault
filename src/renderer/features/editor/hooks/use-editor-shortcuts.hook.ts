import { useEffect } from "react";
import { on } from "@/lib/api";
import type { EditorShortcutHandlers } from "../editor.types";

/**
 * Menu-driven shortcuts (File → Save = ⌘↵) arrive as `shortcut` events; Escape is a
 * plain key listener for the fields around the editor.
 *
 * Escape inside CodeMirror is left alone. Tab indents there, so CodeMirror's own way out
 * is Escape then Tab — and that only works if the Escape doesn't also close the window.
 * ⌘W (the menu's Close) still closes from anywhere.
 */
export function useEditorShortcuts({ onSave, onEscape }: EditorShortcutHandlers) {
  useEffect(
    () =>
      on("shortcut", (s) => {
        if (s === "save") onSave();
      }),
    [onSave],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A combobox or tag field dismissing its own list consumes Escape first.
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest(".cm-editor")) return;
      onEscape();
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}

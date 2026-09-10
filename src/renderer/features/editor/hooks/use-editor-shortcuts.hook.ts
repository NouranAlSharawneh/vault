import { useEffect } from "react";
import { on } from "@/lib/api";
import type { EditorShortcutHandlers } from "../editor.types";

/**
 * Menu-driven shortcuts (File → Save = ⌘↵) arrive as `shortcut` events; Escape is a
 * plain key listener so it works from inside CodeMirror too.
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
      onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}

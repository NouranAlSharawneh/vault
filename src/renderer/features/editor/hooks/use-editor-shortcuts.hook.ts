import { useEffect } from "react";
import { on } from "@/lib/api";

/** Menu-driven shortcuts (File → Save = ⌘↵) arrive as `shortcut` events. */
export function useEditorShortcuts(onSave: () => void) {
  useEffect(
    () =>
      on("shortcut", (s) => {
        if (s === "save") onSave();
      }),
    [onSave],
  );
}

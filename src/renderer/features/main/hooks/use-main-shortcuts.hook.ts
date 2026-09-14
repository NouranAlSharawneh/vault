import { useEffect } from "react";
import { api, on } from "@/lib/api";
import { isEditableTarget } from "@/helpers";

interface Handlers {
  onSearch: () => void;
  onTrash: () => void;
  onSettings: () => void;
  onHistory: () => void;
}

/** Menu shortcuts routed to the main window (⌘K search, ⌘N new, ⌘⌫ trash, ⌘, settings). */
export function useMainShortcuts({ onSearch, onTrash, onSettings, onHistory }: Handlers) {
  useEffect(
    () =>
      on("shortcut", (s) => {
        if (s === "search") onSearch();
        if (s === "new") void api("window:openEditor");
        if (s === "trash") onTrash();
        if (s === "settings") onSettings();
        if (s === "history") onHistory();
      }),
    [onSearch, onTrash, onSettings, onHistory],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch();
      } else if (e.key === "Backspace" && !isEditableTarget(e.target)) {
        e.preventDefault();
        onTrash();
      } else if (e.key === ",") {
        e.preventDefault();
        onSettings();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        onHistory();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch, onTrash, onSettings, onHistory]);
}

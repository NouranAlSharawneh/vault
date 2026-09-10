import { useEffect } from "react";
import { api, on } from "@/lib/api";

interface Handlers {
  onSearch: () => void;
}

/** Menu shortcuts routed to the main window (⌘K search, ⌘N new). */
export function useMainShortcuts({ onSearch }: Handlers) {
  useEffect(
    () =>
      on("shortcut", (s) => {
        if (s === "search") onSearch();
        if (s === "new") void api("window:openEditor");
      }),
    [onSearch],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);
}

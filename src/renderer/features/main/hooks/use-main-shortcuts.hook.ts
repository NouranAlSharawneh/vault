import { useCallback, useEffect, useRef } from "react";
import { isEditableTarget } from "@/helpers";
import { api, fire, on } from "@/lib/api";
import type { Shortcut } from "@shared/ipc";

interface Handlers {
  onSearch: () => void;
  onTrash: () => void;
  onSettings: () => void;
  onHistory: () => void;
}

/**
 * How long after one source fires a shortcut the other is ignored.
 *
 * Every one of these keys is declared twice: as a menu accelerator (`menu.data.ts`) and
 * as a window keydown below. macOS hides the problem by swallowing the key once the
 * accelerator has it, but where both arrive — Windows and Linux — ⌘Y toggled history
 * twice and the drawer never opened, and ⌘⌫ issued two trash calls, the second failing
 * into an error toast. Both sources are worth keeping: the menu makes the shortcuts
 * visible and works from the menu bar, the keydown knows whether you are typing in a
 * field. So they stay, and the second one through the door is dropped.
 */
const ECHO_MS = 300;

/** Menu shortcuts routed to the main window (⌘K search, ⌘N new, ⌘⌫ trash, ⌘, settings). */
export function useMainShortcuts(handlers: Handlers) {
  const lastFired = useRef<Partial<Record<Shortcut, number>>>({});
  // The latest handlers, read when a key arrives. Depending on them re-registered both
  // listeners on every render of the library.
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const dispatch = useCallback((shortcut: Shortcut) => {
    // Nothing reaches the library while a dialog is up: ⌘⌫ with focus on a button in the
    // conflict sheet trashed the document behind it, and ⌘K stacked the palette on top.
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const now = Date.now();
    if (now - (lastFired.current[shortcut] ?? 0) < ECHO_MS) return;
    lastFired.current[shortcut] = now;
    const h = latest.current;
    if (shortcut === "search") h.onSearch();
    if (shortcut === "new") fire(api("window:openEditor"));
    if (shortcut === "trash") h.onTrash();
    if (shortcut === "settings") h.onSettings();
    if (shortcut === "history") h.onHistory();
  }, []);

  // The menu accelerator fires whatever has focus, so the menu path needs the same
  // "are you typing?" check the keydown path makes: ⌘⌫ in the tag filter or the palette
  // means "delete to line start", not "trash the selected document".
  useEffect(
    () =>
      on("shortcut", (shortcut) => {
        if (shortcut === "trash" && isEditableTarget(document.activeElement)) return;
        dispatch(shortcut);
      }),
    [dispatch],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const shortcut: Shortcut | null =
        key === "k"
          ? "search"
          : e.key === "Backspace" && !isEditableTarget(e.target)
            ? "trash"
            : e.key === ","
              ? "settings"
              : key === "y"
                ? "history"
                : null;
      if (!shortcut) return;
      e.preventDefault();
      dispatch(shortcut);
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);
}

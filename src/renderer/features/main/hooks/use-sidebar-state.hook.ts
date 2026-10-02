import { useCallback, useEffect, useState } from "react";
import { SIDEBAR_AUTO_RAIL_PX, SIDEBAR_STORAGE_KEY } from "@/constants";
import { on } from "@/lib/api";
import type { SidebarState } from "../main.types";

const ORDER: SidebarState[] = ["full", "rail", "hidden"];

function read(): SidebarState {
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);

    return ORDER.includes(v as SidebarState) ? (v as SidebarState) : "full";
  } catch {
    return "full";
  }
}

const narrowNow = () => window.innerWidth < SIDEBAR_AUTO_RAIL_PX;

/**
 * Sidebar visibility, cycled by ⌘\ (menu → `shortcut` event) and persisted.
 *
 * A narrow window shows the full sidebar as the rail, so the list and the reader keep
 * their room — without changing the choice that is saved: widen the window and the full
 * sidebar is back. Asking for it while narrow (⌘\, or the rail's expand button) is a
 * choice too, and holds until the window is wide again.
 */
export function useSidebarState() {
  const [chosen, setChosen] = useState<SidebarState>(read);
  const [narrow, setNarrow] = useState(narrowNow);
  const [keepFull, setKeepFull] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const now = narrowNow();
      setNarrow(now);
      if (!now) setKeepFull(false);
    };
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const collapsed = narrow && chosen === "full" && !keepFull;
  const state: SidebarState = collapsed ? "rail" : chosen;

  const setState = useCallback(
    (next: SidebarState) => {
      if (next === "full" && narrow) setKeepFull(true);
      setChosen(next);
    },
    [narrow],
  );

  // From the auto-collapsed rail, ⌘\ brings the sidebar out rather than hiding it.
  const cycle = useCallback(() => {
    if (collapsed) {
      setKeepFull(true);

      return;
    }
    setChosen((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, chosen);
    } catch {
      /* storage unavailable */
    }
  }, [chosen]);

  useEffect(() => on("shortcut", (s) => s === "toggleSidebar" && cycle()), [cycle]);

  return { state, setState, cycle };
}

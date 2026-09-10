import { useCallback, useEffect, useState } from "react";
import { SIDEBAR_STORAGE_KEY } from "@/constants";
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

/** Sidebar visibility, cycled by ⌘\ (menu → `shortcut` event) and persisted. */
export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(read);

  const cycle = useCallback(
    () => setState((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
    } catch {
      /* storage unavailable */
    }
  }, [state]);

  useEffect(() => on("shortcut", (s) => s === "toggleSidebar" && cycle()), [cycle]);

  return { state, setState, cycle };
}

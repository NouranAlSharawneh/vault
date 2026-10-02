import { create } from "zustand";
import type { ListFilter, ReaderView, SortOrder } from "@/features/main/main.types";
import type { LibraryState } from "./library.types";

const SORT_KEY = "library-sort";
const VIEW_KEY = "library-view";
const SORTS: SortOrder[] = ["newest", "oldest", "title"];
const VIEWS: ReaderView[] = ["preview", "markdown", "split"];

export const DEFAULT_FILTER: ListFilter = {
  collection: "all",
  project: null,
  tags: [],
  sort: "newest",
};

function stored<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);

    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: it lasts the session */
  }
}

/** The library as it was left: fresh for a new window, with the sort and view it last had. */
export function initialLibrary(): Pick<LibraryState, "selected" | "filter" | "view" | "scroll"> {
  return {
    selected: null,
    filter: { ...DEFAULT_FILTER, sort: stored(SORT_KEY, SORTS, "newest") },
    view: stored(VIEW_KEY, VIEWS, "preview"),
    scroll: null,
  };
}

/**
 * What the library is showing, outside the component that shows it. Settings is a route
 * in the same window, so opening it unmounted the library — and everything in its state
 * went with it: the selected document, the filter, the sort, the reader view, the scroll.
 * ⌘, then Back landed on a different screen from the one you left.
 */
export const useLibrary = create<LibraryState>((set) => ({
  ...initialLibrary(),
  setSelected: (next) =>
    set((s) => ({ selected: typeof next === "function" ? next(s.selected) : next })),
  setFilter: (next) =>
    set((s) => {
      const filter = typeof next === "function" ? next(s.filter) : next;
      if (filter.sort !== s.filter.sort) remember(SORT_KEY, filter.sort);

      return { filter };
    }),
  setView: (view) => {
    remember(VIEW_KEY, view);
    set({ view });
  },
  setScroll: (scroll) => set({ scroll }),
}));

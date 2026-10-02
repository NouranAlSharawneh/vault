import { create } from "zustand";
import type { ListFilter, ReaderView, SortOrder } from "@/features/main/main.types";
import type { LibraryState, ListScroll } from "./library.types";

const SORT_KEY = "library-sort";
const VIEW_KEY = "library-view";
const SELECTED_KEY = "library-selected";
const SCROLL_KEY = "library-scroll";
const SORTS: SortOrder[] = ["newest", "oldest", "title"];
const VIEWS: ReaderView[] = ["preview", "markdown", "split"];
/** A scroll is written once it stops moving, not on every frame of it. */
const SCROLL_WRITE_MS = 250;

export const DEFAULT_FILTER: ListFilter = {
  collection: "all",
  project: null,
  tags: [],
  sort: "newest",
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function stored<T extends string>(key: string, allowed: T[], fallback: T): T {
  const v = read(key);

  return allowed.includes(v as T) ? (v as T) : fallback;
}

function storedScroll(): ListScroll | null {
  try {
    const v = JSON.parse(read(SCROLL_KEY) ?? "null") as ListScroll | null;

    return v && typeof v.key === "string" && typeof v.top === "number" ? v : null;
  } catch {
    return null;
  }
}

function remember(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: it lasts the session */
  }
}

let scrollWrite: ReturnType<typeof setTimeout> | undefined;

/**
 * The library as it was left — the document that was open and where the list was
 * scrolled included, so a relaunch opens on the same page instead of the top of All
 * documents. A remembered document that is gone by then is dropped by the list itself.
 */
export function initialLibrary(): Pick<
  LibraryState,
  "selected" | "picked" | "filter" | "view" | "scroll"
> {
  return {
    selected: read(SELECTED_KEY),
    picked: [],
    filter: { ...DEFAULT_FILTER, sort: stored(SORT_KEY, SORTS, "newest") },
    view: stored(VIEW_KEY, VIEWS, "preview"),
    scroll: storedScroll(),
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
    set((s) => {
      const selected = typeof next === "function" ? next(s.selected) : next;
      if (selected !== s.selected) remember(SELECTED_KEY, selected);

      return { selected };
    }),
  setPicked: (picked) => set({ picked }),
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
  setScroll: (scroll) => {
    clearTimeout(scrollWrite);
    scrollWrite = setTimeout(() => remember(SCROLL_KEY, JSON.stringify(scroll)), SCROLL_WRITE_MS);
    set({ scroll });
  },
}));

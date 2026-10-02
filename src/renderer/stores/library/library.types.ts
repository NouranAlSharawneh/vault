import type { ListFilter, ReaderView } from "@/features/main/main.types";

/** Where the list was scrolled to, for which list. */
export interface ListScroll {
  key: string;
  top: number;
}

export interface LibraryState {
  /** The document in the reader. */
  selected: string | null;
  filter: ListFilter;
  view: ReaderView;
  scroll: ListScroll | null;
  setSelected: (next: string | null | ((prev: string | null) => string | null)) => void;
  setFilter: (next: ListFilter | ((prev: ListFilter) => ListFilter)) => void;
  setView: (view: ReaderView) => void;
  setScroll: (scroll: ListScroll) => void;
}

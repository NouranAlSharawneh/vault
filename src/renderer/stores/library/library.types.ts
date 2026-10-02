import type { ListFilter, ReaderView } from "@/features/main/main.types";

/** Where the list was scrolled to, for which list. */
export interface ListScroll {
  key: string;
  top: number;
}

export interface LibraryState {
  /** The document in the reader — with several picked, the one the selection started from. */
  selected: string | null;
  /** Documents picked with ⌘- or ⇧-click, for acting on together. Empty for one. */
  picked: string[];
  filter: ListFilter;
  view: ReaderView;
  scroll: ListScroll | null;
  setSelected: (next: string | null | ((prev: string | null) => string | null)) => void;
  setPicked: (picked: string[]) => void;
  setFilter: (next: ListFilter | ((prev: ListFilter) => ListFilter)) => void;
  setView: (view: ReaderView) => void;
  setScroll: (scroll: ListScroll) => void;
}

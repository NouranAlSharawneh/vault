import type { DocContent, DocMeta } from "@shared/types";

/** Result of the last document load, keyed by path so stale loads are ignored. */
export interface LoadedDocument {
  path: string;
  doc: DocContent | null;
}

/** ⌘\ cycles full → rail → hidden. */
export type SidebarState = "full" | "rail" | "hidden";

export type Collection = "all" | "recent" | "starred" | "trash";

export type SortOrder = "newest" | "oldest" | "title";

export interface ListFilter {
  collection: Collection;
  project: string | null;
  tags: string[];
  sort: SortOrder;
}

export type ReaderView = "preview" | "markdown" | "split";

/** The reader's trash actions; at most one runs at a time. */
export type TrashAction = "trash" | "restore" | "purge";

export interface FilteredDocs {
  docs: DocMeta[];
  /** Human label for the list header, e.g. "Atlas API" or "Starred". */
  title: string;
}

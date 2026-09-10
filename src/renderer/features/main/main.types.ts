import type { DocContent, DocMeta } from "@shared/types";

/** Result of the last document load, keyed by path so stale loads are ignored. */
export interface LoadedDocument {
  path: string;
  doc: DocContent | null;
}

/** ⌘\ cycles full → rail → hidden. */
export type SidebarState = "full" | "rail" | "hidden";

export type Collection = "all" | "recent" | "starred";

export type SortOrder = "newest" | "oldest" | "title";

export interface ListFilter {
  collection: Collection;
  project: string | null;
  tags: string[];
  sort: SortOrder;
}

export type ReaderView = "preview" | "markdown" | "split";

export interface FilteredDocs {
  docs: DocMeta[];
  /** Human label for the list header, e.g. "Atlas API" or "Starred". */
  title: string;
}

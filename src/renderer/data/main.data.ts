import type { Collection, ReaderView, SortOrder } from "@/features/main/main.types";

/** Rows at the top of the sidebar. Trash lives at the bottom and is handled on its own. */
export interface CollectionData {
  key: Exclude<Collection, "trash">;
  label: string;
}

export const COLLECTIONS: CollectionData[] = [
  { key: "all", label: "All documents" },
  { key: "recent", label: "Recent" },
  { key: "starred", label: "Starred" },
];

export const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "title", label: "Title" },
];

export const READER_VIEWS: { key: ReaderView; label: string }[] = [
  { key: "preview", label: "Preview" },
  { key: "markdown", label: "Markdown" },
  { key: "split", label: "Split" },
];

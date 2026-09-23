import type { Collection, ReaderView, SortOrder } from "@/features/main/main.types";

/**
 * Rows at the top of the sidebar. Trash is deliberately not one of them: it is reached from
 * Settings › Vault › Trash (`#main?trash`), so the sidebar stays about what you keep.
 */
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

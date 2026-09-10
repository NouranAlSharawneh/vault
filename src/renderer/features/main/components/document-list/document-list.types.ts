import type { DocMeta } from "@shared/types";
import type { SortOrder } from "../../main.types";

export interface DocumentListProps {
  title: string;
  docs: DocMeta[];
  selected: string | null;
  onSelect: (path: string) => void;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
  activeTags: string[];
  onRemoveTag: (t: string) => void;
  onClearTags: () => void;
  sortable?: boolean;
  /** Shown when the list is empty. */
  emptyHint?: string;
}

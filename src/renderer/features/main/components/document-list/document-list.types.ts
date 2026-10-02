import type { DocMeta } from "@shared/types";
import type { BulkAction, Collection, SortOrder } from "../../main.types";

export interface DocumentListProps {
  title: string;
  /** Which list this is, for the empty state: the title alone can't tell a project called "Recent" from Recent. */
  collection: Collection;
  project: string | null;
  /** Identifies the list being shown, so its scroll position is kept per list. */
  scrollKey: string;
  docs: DocMeta[];
  selected: string | null;
  onSelect: (path: string) => void;
  /** Documents picked together with ⌘- or ⇧-click; with no `onPick`, the list picks one. */
  picked?: string[];
  onPick?: (paths: string[]) => void;
  /** Star, unstar or trash every picked document. */
  onBulk?: (action: BulkAction) => void;
  /** Right-click on a row. */
  onRowMenu?: (path: string) => void;
  /** A click on a row's tag. */
  onTag?: (tag: string) => void;
  /** Enter or a double-click: open the document in the editor. */
  onOpen: (path: string) => void;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
  activeTags: string[];
  onRemoveTag: (t: string) => void;
  onClearTags: () => void;
  sortable?: boolean;
  /** The time each row shows. Default `created`; Recent and Trash pass the time they sort by. */
  dateOf?: (d: DocMeta) => string | number;
  /** The capture shortcut, named in the empty vault's hint. */
  hotkey?: string;
}

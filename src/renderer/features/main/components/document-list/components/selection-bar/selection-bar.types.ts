import type { BulkAction } from "../../../../main.types";

export interface SelectionBarProps {
  count: number;
  /** Every picked document is starred, so the star button offers Unstar. */
  allStarred: boolean;
  onBulk: (action: BulkAction) => void;
  onClear: () => void;
}

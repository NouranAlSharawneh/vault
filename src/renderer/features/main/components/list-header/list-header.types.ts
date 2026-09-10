import type { SortOrder } from "../../main.types";

export interface ListHeaderProps {
  title: string;
  count: number;
  sort: SortOrder;
  onSort: (s: SortOrder) => void;
}

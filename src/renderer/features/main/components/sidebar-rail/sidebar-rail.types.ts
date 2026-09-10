import type { IndexSnapshot } from "@shared/types";
import type { ListFilter } from "../../main.types";

export interface SidebarRailProps {
  index: IndexSnapshot | null;
  filter: ListFilter;
  onCollection: (c: ListFilter["collection"]) => void;
  onProject: (slug: string | null) => void;
  onExpand: () => void;
}

import type { IndexSnapshot, VaultConfig } from "@shared/types";
import type { ListFilter } from "../../main.types";

export interface SidebarProps {
  index: IndexSnapshot | null;
  config: VaultConfig;
  filter: ListFilter;
  trashCount: number;
  onCollection: (c: ListFilter["collection"]) => void;
  onProject: (slug: string | null) => void;
  onTag: (tag: string) => void;
}

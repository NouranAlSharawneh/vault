import type { IndexSnapshot, VaultConfig } from "@shared/types";
import type { ListFilter } from "../../main.types";

export interface SidebarProps {
  index: IndexSnapshot | null;
  config: VaultConfig;
  filter: ListFilter;
  /** Documents in the trash; the Trash row shows once there are any. */
  trashCount?: number;
  onCollection: (c: ListFilter["collection"]) => void;
  onProject: (slug: string | null) => void;
  onTag: (tag: string) => void;
  /** Opens Settings, the same as ⌘, and the palette’s “Settings…”. */
  onSettings: () => void;
}

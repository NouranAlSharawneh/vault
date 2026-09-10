import type { IndexSnapshot, VaultConfig } from "@shared/types";

export interface ProjectSidebarProps {
  index: IndexSnapshot | null;
  config: VaultConfig;
  project: string | null;
  onSelect: (slug: string | null) => void;
}

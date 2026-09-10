import type { SidebarState } from "../../main.types";

export interface TopBarProps {
  sidebar: SidebarState;
  onToggleSidebar: () => void;
  onSearch: () => void;
}

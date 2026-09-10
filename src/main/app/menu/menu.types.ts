import type { IpcEvents } from "@shared/ipc";

/** Actions a menu item can trigger; resolved to functions in `app/menu.ts`. */
export type MenuAction =
  "newDocument" | "capture" | "openMain" | "openOnGitHub" | { shortcut: IpcEvents["shortcut"] };

export type MenuItemData =
  | { type: "separator" }
  | { role: Electron.MenuItemConstructorOptions["role"] }
  | { label: string; accelerator?: string; action: MenuAction };

export interface MenuSectionData {
  label?: string;
  role?: Electron.MenuItemConstructorOptions["role"];
  items?: MenuItemData[];
}

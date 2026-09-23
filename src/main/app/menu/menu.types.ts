import type { IpcEvents } from "@shared/ipc";

/** Actions a menu item can trigger; resolved to functions in `app/menu.ts`. */
export type MenuAction =
  | "newDocument"
  | "capture"
  | "openMain"
  | "openOnGitHub"
  | "resetApp"
  | { shortcut: IpcEvents["shortcut"] };

export type MenuItemData =
  | { type: "separator" }
  | { role: Electron.MenuItemConstructorOptions["role"] }
  | { label: string; accelerator?: string; action: MenuAction };

/** What the menu is being built for: the platform's conventions, and whether it is a dev build. */
export interface MenuTarget {
  mac: boolean;
  dev: boolean;
}

export interface MenuSectionData {
  label?: string;
  role?: Electron.MenuItemConstructorOptions["role"];
  items?: MenuItemData[];
}

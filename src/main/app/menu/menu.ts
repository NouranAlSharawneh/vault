import { BrowserWindow, Menu } from "electron";
import { APP_MENU, VAULT_REPO } from "../../data/menu.data";
import type { MenuAction, MenuItemData, MenuSectionData } from "./menu.types";
import { openOnGitHub } from "../../network/github";
import { IS_MAC, openEditorWindow, openMainWindow } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";

function run(action: MenuAction): () => void {
  if (typeof action === "object") {
    return () => BrowserWindow.getFocusedWindow()?.webContents.send("shortcut", action.shortcut);
  }
  switch (action) {
    case "newDocument":
      return () => openEditorWindow();
    case "capture":
      return toggleCapture;
    case "openMain":
      return () => openMainWindow();
    case "openOnGitHub":
      return () => openOnGitHub(VAULT_REPO);
  }
}

function toItem(item: MenuItemData): Electron.MenuItemConstructorOptions {
  if ("type" in item) return { type: "separator" };
  if ("role" in item) return { role: item.role };
  return { label: item.label, accelerator: item.accelerator, click: run(item.action) };
}

function toSection(section: MenuSectionData): Electron.MenuItemConstructorOptions {
  if (section.role) return { role: section.role };
  return { label: section.label, submenu: section.items?.map(toItem) };
}

export function buildAppMenu(): void {
  const template = [...(IS_MAC ? [{ role: "appMenu" as const }] : []), ...APP_MENU.map(toSection)];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

import { BrowserWindow, Menu } from "electron";
import { DEFAULT_HOTKEY } from "@shared/constants";
import { appMenu, VAULT_REPO } from "../../data/menu.data";
import { fire } from "../../lib/fire";
import { openOnGitHub } from "../../network/github";
import { IS_MAC, openEditorWindow, openMainWindow } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";
import { resetApp } from "../session/reset-app";
import type { MenuAction, MenuItemData, MenuSectionData } from "./menu.types";

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
    case "resetApp":
      return () => fire(resetApp(), "resetting Vault");
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

/** (Re)build the menu; called at launch and whenever the capture hotkey changes. */
export function buildAppMenu(captureHotkey = DEFAULT_HOTKEY): void {
  const template = [
    ...(IS_MAC ? [{ role: "appMenu" as const }] : []),
    ...appMenu(captureHotkey).map(toSection),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

import { is } from "@electron-toolkit/utils";
import { BrowserWindow, Menu } from "electron";
import { DEFAULT_HOTKEY } from "@shared/constants";
import { appMenu, APP_REPO } from "../../data/menu.data";
import { fire } from "../../lib/fire";
import { openOnGitHub } from "../../network/github";
import { IS_MAC, openEditorWindow } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";
import { showMainWindow } from "../session/launch-route";
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
      return showMainWindow;
    case "openOnGitHub":
      return () => openOnGitHub(APP_REPO);
    case "resetApp":
      return () => fire(resetApp(), "resetting Marasca");
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
  const template = appMenu(captureHotkey, { mac: IS_MAC, dev: is.dev }).map(toSection);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

import { is } from "@electron-toolkit/utils";
import { BrowserWindow, Menu } from "electron";
import { DEFAULT_HOTKEY } from "@shared/constants";
import { appMenu, APP_REPO } from "../../data/menu.data";
import { fire } from "../../lib/fire";
import { openOnGitHub } from "../../network/github";
import { getMainWindow, IS_MAC, openEditorWindow, openMainWindow } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";
import { showMainWindow } from "../session/launch-route";
import { resetApp } from "../session/reset-app";
import type { MenuAction, MenuItemData, MenuSectionData } from "./menu.types";

type Click = (item: Electron.MenuItem, win: Electron.BaseWindow | undefined) => void;

function run(action: MenuAction): Click {
  if (typeof action === "object") {
    // The window the menu acted on, as Electron hands it over; the focused one otherwise.
    return (_, win) => {
      const target = win instanceof BrowserWindow ? win : BrowserWindow.getFocusedWindow();
      target?.webContents.send("shortcut", action.shortcut);
    };
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
    // Both used to go to whichever window had focus, and only the main window listens:
    // from an editor, or with the main window closed, they did nothing.
    case "openSettings":
      return () => openMainWindow("settings");
    case "search":
      return searchFromAnywhere;
  }
}

function searchFromAnywhere(): void {
  const main = getMainWindow();
  if (main && BrowserWindow.getFocusedWindow() === main) {
    main.webContents.send("shortcut", "search");

    return;
  }
  const win = openMainWindow();
  if (!win.webContents.isLoading()) win.webContents.send("shortcut", "search");
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

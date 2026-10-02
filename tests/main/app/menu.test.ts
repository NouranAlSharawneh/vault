import { beforeEach, describe, expect, it, vi } from "vitest";

// Only Electron's menu is faked: the template the app builds is kept, to click its items.
const e = vi.hoisted(() => {
  class BrowserWindow {
    static focused: BrowserWindow | null = null;
    static getFocusedWindow = () => BrowserWindow.focused;
    webContents = { send: vi.fn() };
  }

  return { BrowserWindow, template: [] as Electron.MenuItemConstructorOptions[] };
});

vi.mock("electron", () => ({
  BrowserWindow: e.BrowserWindow,
  Menu: {
    buildFromTemplate: (t: Electron.MenuItemConstructorOptions[]) => {
      e.template = t;

      return t;
    },
    setApplicationMenu: vi.fn(),
  },
}));
vi.mock("@electron-toolkit/utils", () => ({ is: { dev: false } }));
vi.mock("@main/windows", () => ({ IS_MAC: true }));
vi.mock("@main/app/hotkey/hotkey", () => ({ toggleCapture: vi.fn() }));
vi.mock("@main/app/session/launch-route", () => ({ showMainWindow: vi.fn() }));
vi.mock("@main/app/session/reset-app", () => ({ resetApp: vi.fn() }));
vi.mock("@main/network/github", () => ({ openOnGitHub: vi.fn() }));

import { buildAppMenu } from "@main/app/menu/menu";

function item(label: string): Electron.MenuItemConstructorOptions {
  for (const section of e.template) {
    const found = (section.submenu as Electron.MenuItemConstructorOptions[] | undefined)?.find(
      (i) => i.label === label,
    );
    if (found) return found;
  }
  throw new Error(`no menu item ${label}`);
}

const click = (label: string, win: unknown) =>
  (item(label).click as (i: unknown, w: unknown, ev: unknown) => void)({}, win, {});

beforeEach(() => {
  e.BrowserWindow.focused = null;
  buildAppMenu();
});

describe("a menu shortcut", () => {
  it("goes to the window the menu acted on, even when none reads as focused", () => {
    // ⌘S from an editor showed nothing: the save went to getFocusedWindow(), which was null.
    const editor = new e.BrowserWindow();
    click("Save", editor);

    expect(editor.webContents.send).toHaveBeenCalledWith("shortcut", "save");
  });

  it("falls back to the focused window when the menu names none", () => {
    const main = new e.BrowserWindow();
    e.BrowserWindow.focused = main;
    click("Save and Close", undefined);

    expect(main.webContents.send).toHaveBeenCalledWith("shortcut", "saveClose");
  });
});

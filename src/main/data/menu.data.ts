import type { MenuItemData, MenuSectionData, MenuTarget } from "../app/menu/menu.types";

const SETTINGS: MenuItemData = {
  label: "Settings…",
  accelerator: "CmdOrCtrl+,",
  action: { shortcut: "settings" },
};
const RESET: MenuItemData = { label: "Reset Marasca…", action: "resetApp" };
const SEPARATOR: MenuItemData = { type: "separator" };

/**
 * Application menu, as plain data. Behaviour lives in `app/menu.ts`.
 *
 * On macOS, Settings and Reset live in the app menu, where every Mac app keeps them;
 * elsewhere they sit in File. Reload and the dev tools only exist in development — in a
 * release they are a way to lose an unsaved draft, not a feature.
 */
export const appMenu = (captureHotkey: string, { mac, dev }: MenuTarget): MenuSectionData[] => [
  ...(mac
    ? [
        {
          label: "Marasca",
          items: [
            { role: "about" as const },
            SEPARATOR,
            SETTINGS,
            RESET,
            SEPARATOR,
            { role: "services" as const },
            SEPARATOR,
            { role: "hide" as const },
            { role: "hideOthers" as const },
            { role: "unhide" as const },
            SEPARATOR,
            { role: "quit" as const },
          ],
        },
      ]
    : []),
  {
    label: "File",
    items: [
      { label: "New Document", accelerator: "CmdOrCtrl+N", action: "newDocument" },
      { label: "Capture from Clipboard", accelerator: captureHotkey, action: "capture" },
      { label: "Save", accelerator: "CmdOrCtrl+Enter", action: { shortcut: "save" } },
      SEPARATOR,
      { label: "Move to Trash", accelerator: "CmdOrCtrl+Backspace", action: { shortcut: "trash" } },
      SEPARATOR,
      { label: "Open Marasca Window", accelerator: "CmdOrCtrl+Shift+V", action: "openMain" },
      SEPARATOR,
      ...(mac ? [] : [SETTINGS, RESET, SEPARATOR]),
      { role: "close" },
    ],
  },
  { role: "editMenu" },
  {
    label: "View",
    items: [
      { label: "Search…", accelerator: "CmdOrCtrl+K", action: { shortcut: "search" } },
      {
        label: "Toggle Sidebar",
        accelerator: "CmdOrCtrl+\\",
        action: { shortcut: "toggleSidebar" },
      },
      { label: "History", accelerator: "CmdOrCtrl+Y", action: { shortcut: "history" } },
      SEPARATOR,
      ...(dev
        ? [
            { role: "reload" as const },
            { role: "forceReload" as const },
            { role: "toggleDevTools" as const },
            SEPARATOR,
          ]
        : []),
      { role: "togglefullscreen" },
    ],
  },
  { role: "windowMenu" },
  {
    label: "Help",
    items: [{ label: "Marasca on GitHub", action: "openOnGitHub" }],
  },
];

export const APP_REPO = "NouranAlSharawneh/vault";

import type { MenuSectionData } from "../app/menu/menu.types";

/** Application menu, as plain data. Behaviour lives in `app/menu.ts`. */
export const appMenu = (captureHotkey: string): MenuSectionData[] => [
  {
    label: "File",
    items: [
      { label: "New Document", accelerator: "CmdOrCtrl+N", action: "newDocument" },
      { label: "Capture from Clipboard", accelerator: captureHotkey, action: "capture" },
      { label: "Save", accelerator: "CmdOrCtrl+Enter", action: { shortcut: "save" } },
      { type: "separator" },
      { label: "Move to Trash", accelerator: "CmdOrCtrl+Backspace", action: { shortcut: "trash" } },
      { type: "separator" },
      { label: "Open Vault Window", accelerator: "CmdOrCtrl+Shift+V", action: "openMain" },
      { type: "separator" },
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
      { label: "Settings…", accelerator: "CmdOrCtrl+,", action: { shortcut: "settings" } },
      { type: "separator" },
      { role: "reload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  { role: "windowMenu" },
  {
    label: "Help",
    items: [
      { label: "Vault on GitHub", action: "openOnGitHub" },
      { type: "separator" },
      { label: "Reset Vault (sign out & forget vault)…", action: "resetApp" },
    ],
  },
];

export const VAULT_REPO = "NouranAlSharawneh/vault";

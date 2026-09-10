import { DEFAULT_HOTKEY } from "@shared/constants";
import type { TrayItemData } from "../app/tray/tray.types";

/** Menu-bar items, as plain data. Header lines (account, sync label) are added at build time. */
export const TRAY_MENU: TrayItemData[] = [
  {
    label: "Capture from clipboard",
    accelerator: DEFAULT_HOTKEY,
    action: "capture",
    enabledWhen: "always",
  },
  {
    label: "Open Vault",
    accelerator: "CmdOrCtrl+Shift+V",
    action: "openMain",
    enabledWhen: "always",
  },
  { label: "New document", action: "newDocument", enabledWhen: "always" },
  { type: "separator" },
  { label: "Push now", action: "pushNow", enabledWhen: "remote" },
  { label: "Rescan vault folder", action: "rescan", enabledWhen: "vault" },
  { label: "Open on GitHub", action: "openOnGitHub", enabledWhen: "remote" },
  { type: "separator" },
  { role: "quit", label: "Quit Vault" },
];

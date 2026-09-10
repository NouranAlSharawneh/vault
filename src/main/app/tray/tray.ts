import { Menu, nativeImage, Tray } from "electron";
import type { SyncStatus } from "@shared/types";
import { TRAY_MENU } from "../../data/tray.data";
import type { TrayAction, TrayItemData } from "./tray.types";
import { openOnGitHub } from "../../network/github";
import { IS_MAC, openEditorWindow, openMainWindow } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";
import { session } from "../session/session";

let tray: Tray | null = null;

function trayIcon(): Electron.NativeImage {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<circle cx="11" cy="20" r="6" fill="#000"/><circle cx="21" cy="20" r="6" fill="#000"/></svg>';
  const img = nativeImage.createFromDataURL(
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
  );
  const resized = img.resize({ width: 16, height: 16 });
  resized.setTemplateImage(true);
  return resized;
}

function syncLabel(s: SyncStatus | undefined): string {
  switch (s?.state) {
    case "pending":
      return `${s.ahead} commit(s) waiting`;
    case "pushing":
      return "Pushing…";
    case "offline":
      return "Offline — will retry";
    case "conflict":
      return "Conflict needs attention";
    case "error":
      return s.lastError ?? "Sync error";
    default:
      return "All pushed";
  }
}

function run(action: TrayAction): () => void {
  const vault = session.vault;
  switch (action) {
    case "capture":
      return toggleCapture;
    case "openMain":
      return () => openMainWindow();
    case "newDocument":
      return () => openEditorWindow();
    case "pushNow":
      return () => void vault?.pushNow();
    case "rescan":
      return () => void vault?.index.rescan();
    case "openOnGitHub":
      return () => openOnGitHub(vault?.config.remote ?? "");
  }
}

function toItem(item: TrayItemData): Electron.MenuItemConstructorOptions {
  if ("type" in item) return { type: "separator" };
  if ("role" in item) return { role: item.role, label: item.label };
  const vault = session.vault;
  const enabled =
    item.enabledWhen === "always" ||
    (item.enabledWhen === "vault" ? !!vault : !!vault?.config.remote);
  return { label: item.label, accelerator: item.accelerator, enabled, click: run(item.action) };
}

export function updateTray(): void {
  if (!tray) return;
  const label = syncLabel(session.vault?.status());
  tray.setToolTip(`Vault — ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Vault${session.auth.user ? ` · ${session.auth.user.login}` : ""}`, enabled: false },
      { label, enabled: false },
      { type: "separator" },
      ...TRAY_MENU.map(toItem),
    ]),
  );
}

export function createTray(): void {
  tray = new Tray(trayIcon());
  tray.on("click", () => (IS_MAC ? tray?.popUpContextMenu() : openMainWindow()));
  updateTray();
  session.onAuthChange(updateTray);
}

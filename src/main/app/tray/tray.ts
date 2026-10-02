import { app, Menu, Tray } from "electron";
import { getSettings } from "../../store/settings.store";
import { revealDoc } from "../../windows";
import { toggleCapture } from "../hotkey/hotkey";
import { showMainWindow } from "../session/launch-route";
import { session } from "../session/session";
import { trayImage } from "./tray-icon";
import { recentDocs, syncLine, trayMenu } from "./tray-menu";
import type { TrayMenuItem, TrayState } from "./tray.types";

let tray: Tray | null = null;
let stopListening: (() => void) | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

function state(): TrayState {
  const vault = session.vault;
  const config = getSettings().vault;

  return {
    hasVault: !!vault,
    remote: config?.remote ?? null,
    sync: vault?.status() ?? null,
    recent: vault ? recentDocs(vault.index.snapshot().docs) : [],
  };
}

function toTemplate(item: TrayMenuItem): Electron.MenuItemConstructorOptions {
  switch (item.kind) {
    case "separator":
      return { type: "separator" };
    case "note":
      return { label: item.label, enabled: false };
    case "doc":
      return { label: item.label, click: () => revealDoc(item.path) };
    case "action":
      return {
        label: item.label,
        enabled: item.enabled ?? true,
        click:
          item.action === "capture"
            ? toggleCapture
            : item.action === "open"
              ? showMainWindow
              : () => app.quit(),
      };
  }
}

function rebuild(): void {
  if (!tray || tray.isDestroyed()) return;
  const s = state();
  tray.setContextMenu(Menu.buildFromTemplate(trayMenu(s).map(toTemplate)));
  tray.setToolTip(`Marasca — ${s.hasVault ? syncLine(s.sync, s.remote) : "no vault yet"}`);
}

/** Pushes and indexing report often; the menu follows the last word, not every one. */
function scheduleRebuild(): void {
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    rebuild();
  }, 200);
}

/**
 * The menu bar item: capture without finding the window, open the vault, see whether
 * everything has reached GitHub, and jump to something captured a moment ago. The dock
 * icon is gone for long stretches (the app lives behind a global shortcut); this is what
 * says it is still running.
 */
export function createTray(): void {
  if (tray) return;
  tray = new Tray(trayImage());
  rebuild();
  stopListening = session.onVaultChange(scheduleRebuild);
}

/** Gone with the app: a quit that left the icon behind would leave a menu that does nothing. */
export function destroyTray(): void {
  stopListening?.();
  stopListening = null;
  if (pending) clearTimeout(pending);
  pending = null;
  tray?.destroy();
  tray = null;
}

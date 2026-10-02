import { app } from "electron";
import type { LoginItemState } from "@shared/types";

/**
 * Only the installed app can be a login item. A development run would register the
 * Electron binary itself — a stray "Electron" opening at every login — and Linux has no
 * login items to set at all.
 */
function available(): boolean {
  return app.isPackaged && (process.platform === "darwin" || process.platform === "win32");
}

export function loginItemState(): LoginItemState {
  const ok = available();

  return { openAtLogin: ok && app.getLoginItemSettings().openAtLogin, available: ok };
}

/**
 * Open at login, so the capture shortcut works from the moment the Mac starts — it only
 * exists while Marasca runs. Opened that way it opens no window (`openedAtLogin`): the
 * menu bar item and the shortcut are the way in.
 */
export function setLoginItem(openAtLogin: boolean): LoginItemState {
  if (!available())
    throw new Error("Open at login works in the installed Marasca, not in a development build.");
  app.setLoginItemSettings({ openAtLogin });

  return loginItemState();
}

/** Launched by the login item: start quietly, with no window. */
export function openedAtLogin(): boolean {
  return available() && app.getLoginItemSettings().wasOpenedAtLogin === true;
}

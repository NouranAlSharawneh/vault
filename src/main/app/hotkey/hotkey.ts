import { globalShortcut } from "electron";
import { readClipboard } from "../../services/capture/capture.service";
import {
  hideCaptureWindow,
  isCaptureVisible,
  openMainWindow,
  showCaptureWindow,
} from "../../windows";
import { session } from "../session/session";

/** ⌃⌥V (configurable): show the capture sheet pre-filled from the clipboard, or hide it. */
export function toggleCapture(): void {
  if (isCaptureVisible()) return hideCaptureWindow();
  if (!session.vault) {
    openMainWindow("onboarding");

    return;
  }
  const win = showCaptureWindow();
  void readClipboard().then((payload) => {
    const send = () => win.webContents.send("capture:shown", payload);
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send);
    else send();
  });
}

/** Bind the capture shortcut. False when the OS refused it (taken by another app, or invalid). */
export function registerHotkey(accelerator: string): boolean {
  globalShortcut.unregisterAll();
  try {
    const ok = globalShortcut.register(accelerator, toggleCapture);
    if (!ok) console.warn("Hotkey unavailable:", accelerator);

    return ok;
  } catch (e) {
    console.warn("Hotkey failed", e);

    return false;
  }
}

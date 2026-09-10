import { globalShortcut } from "electron";
import { readClipboard } from "../../services/capture/capture.service";
import {
  hideCaptureWindow,
  isCaptureVisible,
  openMainWindow,
  showCaptureWindow,
} from "../../windows";
import { session } from "../session/session";

/** ⌥Space: show the capture sheet pre-filled from the clipboard, or hide it. */
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

export function registerHotkey(accelerator: string): void {
  globalShortcut.unregisterAll();
  try {
    if (!globalShortcut.register(accelerator, toggleCapture))
      console.warn("Hotkey unavailable:", accelerator);
  } catch (e) {
    console.warn("Hotkey failed", e);
  }
}

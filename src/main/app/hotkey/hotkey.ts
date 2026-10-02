import { globalShortcut } from "electron";
import type { HotkeyStatus } from "@shared/types";
import { fire } from "../../lib/fire";
import { readClipboard } from "../../services/capture/capture.service";
import { hideCaptureWindow, isCaptureVisible, showCaptureWindow } from "../../windows";
import { showMainWindow } from "../session/launch-route";
import { session } from "../session/session";

/** ⌃⌥V (configurable): show the capture sheet pre-filled from the clipboard, or hide it. */
export function toggleCapture(): void {
  if (isCaptureVisible()) return hideCaptureWindow("dismiss");
  // No vault open: show whatever the app would open on. A vault that failed to open
  // belongs on its "couldn't open" screen, not in a first-run setup that starts over.
  if (!session.vault) {
    showMainWindow();

    return;
  }
  const win = showCaptureWindow();
  fire(
    readClipboard().then((payload) => {
      const send = () => win.webContents.send("capture:shown", payload);
      if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send);
      else send();
    }),
    "reading the clipboard",
  );
}

/**
 * What the last registration came to. Launch and setup used to drop the answer, so a
 * shortcut another app already held simply did nothing, with nobody told why.
 */
let status: HotkeyStatus = { accelerator: null, active: false };

export function hotkeyStatus(): HotkeyStatus {
  return status;
}

/** Bind the capture shortcut. False when the OS refused it (taken by another app, or invalid). */
export function registerHotkey(accelerator: string): boolean {
  globalShortcut.unregisterAll();
  let ok = false;
  try {
    ok = globalShortcut.register(accelerator, toggleCapture);
    if (!ok) console.warn("Hotkey unavailable:", accelerator);
  } catch (e) {
    console.warn("Hotkey failed", e);
  }
  status = { accelerator, active: ok };

  return ok;
}

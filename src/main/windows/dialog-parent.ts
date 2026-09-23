import type { BrowserWindow } from "electron";
import { isCaptureWindow } from "./capture.window";

/**
 * The window a dialog should attach to, or null to show it on its own.
 *
 * Attached, a dialog is a sheet on macOS and modal elsewhere, so it cannot open behind the
 * window that asked. Never the capture sheet: it is a transparent, frameless panel that
 * hides itself when it loses focus, and has nowhere to hang a sheet from.
 */
export function dialogParent(win: BrowserWindow | null): BrowserWindow | null {
  return win && !win.isDestroyed() && !isCaptureWindow(win) ? win : null;
}

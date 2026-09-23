import { app, BrowserWindow, screen } from "electron";
import {
  CAPTURE_MAX_HEIGHT,
  CAPTURE_MIN_HEIGHT,
  CAPTURE_WINDOW,
  OVERLAY_BG,
} from "@shared/constants";
import { fire } from "../lib/fire";
import { editorWindowCount } from "./editor.window";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";
import { getMainWindow } from "./main.window";

let captureWin: BrowserWindow | null = null;
/** Dialogs opened from the sheet that are still up. While any is, losing focus is expected. */
let dialogsOpen = 0;

/** Frameless sheet that floats over whatever app is in front. Hidden, never destroyed. */
export function getCaptureWindow(): BrowserWindow {
  if (captureWin && !captureWin.isDestroyed()) return captureWin;
  captureWin = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    ...CAPTURE_WINDOW,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    transparent: IS_MAC,
    backgroundColor: IS_MAC ? "#00000000" : OVERLAY_BG,
    // No `vibrancy` here on purpose: macOS refuses to composite it with a transparent
    // window and paints an opaque light panel instead — the sheet arrives as a white
    // box. The panel does its own blur in CSS (`backdrop-blur-xl`).
    fullscreenable: false,
  });
  captureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureWin.setAlwaysOnTop(true, "floating");
  captureWin.on("blur", () => {
    if (dialogsOpen > 0) return;
    if (captureWin?.isVisible() && !captureWin.webContents.isDevToolsOpened()) hideCaptureWindow();
  });
  captureWin.on("closed", () => (captureWin = null));
  loadRoute(captureWin, "capture");

  return captureWin;
}

export function showCaptureWindow(): BrowserWindow {
  const win = getCaptureWindow();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const [w] = win.getSize();
  win.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height * 0.18), false);
  if (IS_MAC && app.dock) fire(app.dock.show(), "showing the dock icon");
  win.show();
  win.focus();

  return win;
}

export function hideCaptureWindow(): void {
  const win = captureWin;
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send("capture:hidden", null);
    win.hide();
    if (IS_MAC && !getMainWindow() && editorWindowCount() === 0) app.hide();
  }
}

/**
 * Run a native dialog without the sheet hiding under it. The dialog takes focus, and the
 * sheet hides on blur — so choosing an image folder used to throw the whole capture away.
 * Focus goes back to the sheet afterwards if it was the one that asked.
 */
export async function whileCaptureDialogOpen<T>(open: () => Promise<T>): Promise<T> {
  const win = captureWin && !captureWin.isDestroyed() ? captureWin : null;
  const fromSheet = !!win?.isVisible() && win.isFocused();
  dialogsOpen += 1;
  try {
    return await open();
  } finally {
    dialogsOpen -= 1;
    if (fromSheet && win && !win.isDestroyed() && win.isVisible()) win.focus();
  }
}

export function isCaptureVisible(): boolean {
  return !!captureWin && !captureWin.isDestroyed() && captureWin.isVisible();
}

/**
 * Fit the sheet to its content. A short clip used to leave dead space below the buttons,
 * because the window was a fixed height whatever was in it.
 */
export function resizeCaptureWindow(height: number): void {
  const win = captureWin;
  if (!win || win.isDestroyed()) return;
  const wanted = Math.round(Math.min(Math.max(height, CAPTURE_MIN_HEIGHT), CAPTURE_MAX_HEIGHT));
  const [w, h] = win.getContentSize();
  if (Math.abs(h - wanted) > 1) win.setContentSize(w, wanted, false);
}

export function isCaptureWindow(win: BrowserWindow): boolean {
  return win === captureWin;
}

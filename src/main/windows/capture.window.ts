import { app, BrowserWindow, screen } from "electron";
import { COMMON_WINDOW_OPTIONS, IS_MAC, loadRoute } from "./load-route";
import { getMainWindow } from "./main.window";
import { editorWindowCount } from "./editor.window";

let captureWin: BrowserWindow | null = null;

/** Frameless sheet that floats over whatever app is in front. Hidden, never destroyed. */
export function getCaptureWindow(): BrowserWindow {
  if (captureWin && !captureWin.isDestroyed()) return captureWin;
  captureWin = new BrowserWindow({
    ...COMMON_WINDOW_OPTIONS,
    width: 720,
    height: 520,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    transparent: IS_MAC,
    backgroundColor: IS_MAC ? "#00000000" : "#1e1d1b",
    vibrancy: IS_MAC ? "hud" : undefined,
    visualEffectState: "active",
    fullscreenable: false,
  });
  captureWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  captureWin.setAlwaysOnTop(true, "floating");
  captureWin.on("blur", () => {
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
  if (IS_MAC) app.dock?.show();
  win.show();
  win.focus();
  return win;
}

export function hideCaptureWindow(): void {
  const win = captureWin;
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.hide();
    if (IS_MAC && !getMainWindow() && editorWindowCount() === 0) app.hide();
  }
}

export function isCaptureVisible(): boolean {
  return !!captureWin && !captureWin.isDestroyed() && captureWin.isVisible();
}

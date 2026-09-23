import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The sheet is a real BrowserWindow in the app; here it is a stand-in that remembers
// whether it is showing and what it was told, so hide/blur behaviour can be driven directly.
class FakeWindow extends EventEmitter {
  visible = false;
  sent: [string, unknown][] = [];
  webContents = {
    send: (channel: string, payload: unknown) => this.sent.push([channel, payload]),
    isDevToolsOpened: () => false,
  };

  isDestroyed = () => false;
  isVisible = () => this.visible;
  show = () => void (this.visible = true);
  hide = () => void (this.visible = false);
  focused = false;
  isFocused = () => this.focused;
  focus = vi.fn(() => void (this.focused = true));
  setVisibleOnAllWorkspaces = vi.fn();
  setAlwaysOnTop = vi.fn();
  getSize = () => [720, 430];
  setPosition = vi.fn();
}

const electron = vi.hoisted(() => ({
  windows: [] as unknown[],
  appHide: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { hide: electron.appHide, dock: undefined },
  BrowserWindow: vi.fn(function BrowserWindow() {
    const w = new FakeWindow();
    electron.windows.push(w);

    return w;
  }),
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }),
  },
}));
vi.mock("@main/windows/load-route", () => ({
  COMMON_WINDOW_OPTIONS: {},
  IS_MAC: false,
  loadRoute: vi.fn(),
}));
vi.mock("@main/windows/main.window", () => ({ getMainWindow: () => null }));
vi.mock("@main/windows/editor.window", () => ({ editorWindowCount: () => 0 }));

async function sheet() {
  vi.resetModules();
  electron.windows.length = 0;
  const mod = await import("@main/windows/capture.window");
  mod.showCaptureWindow();

  return { mod, win: electron.windows[0] as FakeWindow };
}

describe("capture window", () => {
  beforeEach(() => electron.appHide.mockClear());

  it("tells the sheet it was hidden, so a pending save flash can stand down", async () => {
    const { mod, win } = await sheet();
    mod.hideCaptureWindow();
    expect(win.visible).toBe(false);
    expect(win.sent).toContainEqual(["capture:hidden", null]);
  });

  it("hides when it loses focus", async () => {
    const { win } = await sheet();
    win.emit("blur");
    expect(win.visible).toBe(false);
  });

  it("stays up while a folder picker it opened has focus, then takes focus back", async () => {
    const { mod, win } = await sheet();
    win.focused = true;
    let close: (folder: string) => void = () => undefined;
    const picked = mod.whileCaptureDialogOpen(
      () => new Promise<string>((resolve) => (close = resolve)),
    );
    // The dialog takes focus, which is exactly what used to hide the sheet under it.
    win.focused = false;
    win.focus.mockClear();
    win.emit("blur");
    expect(win.visible).toBe(true);
    close("/Users/me/concorde");
    await expect(picked).resolves.toBe("/Users/me/concorde");
    expect(win.focus).toHaveBeenCalled();
    // Once the dialog is gone, clicking away hides the sheet again as usual.
    win.emit("blur");
    expect(win.visible).toBe(false);
  });

  it("still lets go of the hold when the dialog fails", async () => {
    const { mod, win } = await sheet();
    await expect(
      mod.whileCaptureDialogOpen(() => Promise.reject(new Error("no dialog"))),
    ).rejects.toThrow("no dialog");
    win.emit("blur");
    expect(win.visible).toBe(false);
  });
});

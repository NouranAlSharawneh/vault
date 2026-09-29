import { beforeEach, describe, expect, it, vi } from "vitest";

// Never the real thing: calling it from a test would add a login item to this Mac.
const app = vi.hoisted(() => ({
  isPackaged: false,
  setLoginItemSettings: vi.fn(),
  getLoginItemSettings: vi.fn(() => ({ openAtLogin: false, wasOpenedAtLogin: false })),
}));
vi.mock("electron", () => ({ app }));

import { loginItemState, openedAtLogin, setLoginItem } from "@main/app/login-item/login-item";

beforeEach(() => {
  app.isPackaged = false;
  app.setLoginItemSettings.mockClear();
  app.getLoginItemSettings.mockReturnValue({ openAtLogin: false, wasOpenedAtLogin: false });
});

describe("open at login", () => {
  it("can't be turned on from a development build, which would register Electron", () => {
    expect(loginItemState()).toEqual({ openAtLogin: false, available: false });
    expect(() => setLoginItem(true)).toThrow(/installed Marasca/);
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it("is set, and read back, in the installed app", () => {
    if (process.platform !== "darwin" && process.platform !== "win32") return;
    app.isPackaged = true;
    app.getLoginItemSettings.mockReturnValue({ openAtLogin: true, wasOpenedAtLogin: true });
    expect(setLoginItem(true)).toEqual({ openAtLogin: true, available: true });
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    // Opened by the login item: no window to put in the way.
    expect(openedAtLogin()).toBe(true);
  });
});

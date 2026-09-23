import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the OS's answer is faked: whether `globalShortcut.register` takes the shortcut.
const os = vi.hoisted(() => ({ taken: new Set<string>(), invalid: new Set<string>() }));

vi.mock("electron", () => ({
  globalShortcut: {
    unregisterAll: vi.fn(),
    register: (accelerator: string) => {
      if (os.invalid.has(accelerator)) throw new Error("Invalid accelerator");

      return !os.taken.has(accelerator);
    },
  },
}));
vi.mock("@main/services/capture/capture.service", () => ({ readClipboard: vi.fn() }));
vi.mock("@main/windows", () => ({}));
vi.mock("@main/app/session/session", () => ({ session: {} }));

import { hotkeyStatus, registerHotkey } from "@main/app/hotkey/hotkey";

beforeEach(() => {
  os.taken.clear();
  os.invalid.clear();
});

describe("the capture shortcut's status", () => {
  it("remembers that the OS refused it, so the app can say so", () => {
    os.taken.add("Control+Alt+V");

    expect(registerHotkey("Control+Alt+V")).toBe(false);
    expect(hotkeyStatus()).toEqual({ accelerator: "Control+Alt+V", active: false });
  });

  it("reads active once a shortcut registers", () => {
    os.taken.add("Control+Alt+V");
    registerHotkey("Control+Alt+V");
    registerHotkey("Alt+Super+V");

    expect(hotkeyStatus()).toEqual({ accelerator: "Alt+Super+V", active: true });
  });

  it("treats a shortcut the OS can't parse as not bound, without throwing", () => {
    os.invalid.add("Nonsense");

    expect(registerHotkey("Nonsense")).toBe(false);
    expect(hotkeyStatus()).toEqual({ accelerator: "Nonsense", active: false });
  });
});

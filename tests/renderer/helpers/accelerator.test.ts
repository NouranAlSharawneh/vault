// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { acceleratorLabel, shortcutKeys, toAccelerator } from "@/helpers";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("toAccelerator", () => {
  it("builds Electron accelerators from key events, modifiers in a stable order", () => {
    expect(toAccelerator(key({ key: "v", code: "KeyV", ctrlKey: true, altKey: true }))).toBe(
      "Control+Alt+V",
    );
    expect(toAccelerator(key({ key: " ", code: "Space", altKey: true }))).toBe("Alt+Space");
    expect(toAccelerator(key({ key: "3", code: "Digit3", metaKey: true, shiftKey: true }))).toBe(
      "Shift+Super+3",
    );
    expect(toAccelerator(key({ key: "F9", code: "F9", ctrlKey: true }))).toBe("Control+F9");
  });

  it("ignores lone modifiers and keys without a modifier", () => {
    expect(toAccelerator(key({ key: "Control", code: "ControlLeft", ctrlKey: true }))).toBeNull();
    expect(toAccelerator(key({ key: "v", code: "KeyV" }))).toBeNull();
  });

  it("refuses shortcuts that would take over ordinary typing everywhere", () => {
    // ⇧⇥, pressed to leave the recorder, used to become the global shortcut.
    expect(toAccelerator(key({ key: "Tab", code: "Tab", shiftKey: true }))).toBeNull();
    expect(toAccelerator(key({ key: "A", code: "KeyA", shiftKey: true }))).toBeNull();
    // ⌥L is how a German keyboard types @.
    expect(toAccelerator(key({ key: "@", code: "KeyL", altKey: true }))).toBeNull();
    expect(toAccelerator(key({ key: "F5", code: "F5", shiftKey: true }))).toBe("Shift+F5");
  });

  it("names punctuation by its key, so Electron can read it", () => {
    expect(toAccelerator(key({ key: "+", code: "Equal", ctrlKey: true, shiftKey: true }))).toBe(
      "Control+Shift+=",
    );
    expect(toAccelerator(key({ key: "Dead", code: "KeyE", altKey: true, ctrlKey: true }))).toBe(
      "Control+Alt+E",
    );
    expect(toAccelerator(key({ key: "Dead", code: "IntlRo", ctrlKey: true }))).toBeNull();
  });
});

describe("acceleratorLabel", () => {
  it("renders accelerators for humans", () => {
    const label = acceleratorLabel("Control+Alt+V");
    expect(["⌃⌥V", "Ctrl+Alt+V"]).toContain(label);
    expect(["⌘K", "Ctrl+K"]).toContain(acceleratorLabel("CmdOrCtrl+K"));
  });
});

describe("shortcutKeys", () => {
  it("splits a shortcut into one cap per key, alternatives apart", () => {
    expect([
      [["↑"], ["↓"]],
      [["Up"], ["Down"]],
    ]).toContainEqual(shortcutKeys("Up / Down"));
    expect([[["⌘", "⇧", "K"]], [["Ctrl", "Shift", "K"]]]).toContainEqual(
      shortcutKeys("CmdOrCtrl+Shift+K"),
    );
  });
});

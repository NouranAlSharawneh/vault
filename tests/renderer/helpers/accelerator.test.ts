// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { acceleratorLabel, toAccelerator } from "@/helpers";

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
});

describe("acceleratorLabel", () => {
  it("renders accelerators for humans", () => {
    const label = acceleratorLabel("Control+Alt+V");
    expect(["⌃⌥V", "Ctrl+Alt+V"]).toContain(label);
    expect(["⌘K", "Ctrl+K"]).toContain(acceleratorLabel("CmdOrCtrl+K"));
  });
});

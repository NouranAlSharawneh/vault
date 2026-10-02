import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useCaptureKeys } from "@/features/capture/hooks/use-capture-keys.hook";

const handlers = () => ({
  onSave: vi.fn(),
  onOpenEditor: vi.fn(),
  onActions: vi.fn(),
  onHide: vi.fn(),
  onPickProject: vi.fn(),
  onJump: vi.fn(),
});

const press = (init: KeyboardEventInit, target: EventTarget = window) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);

  return e;
};

describe("capture sheet shortcuts", () => {
  it("⌘1–⌘9 pick a recent project, from anywhere in the sheet", () => {
    const h = handlers();
    renderHook(() => useCaptureKeys(h));
    expect(press({ key: "2", metaKey: true }).defaultPrevented).toBe(true);
    expect(h.onPickProject).toHaveBeenCalledWith(2);
    press({ key: "0", metaKey: true });
    expect(h.onPickProject).toHaveBeenCalledTimes(1);
  });

  it("# jumps to Tags and @ to Project, without typing the character", () => {
    const h = handlers();
    renderHook(() => useCaptureKeys(h));
    expect(press({ key: "#", shiftKey: true }).defaultPrevented).toBe(true);
    expect(h.onJump).toHaveBeenLastCalledWith("tags");
    press({ key: "@", shiftKey: true });
    expect(h.onJump).toHaveBeenLastCalledWith("project");
  });

  it("leaves # and @ alone in a text field, where they are text", () => {
    const h = handlers();
    renderHook(() => useCaptureKeys(h));
    const field = document.createElement("input");
    document.body.append(field);
    const e = press({ key: "#", shiftKey: true }, field);
    expect(e.defaultPrevented).toBe(false);
    expect(h.onJump).not.toHaveBeenCalled();
    field.remove();
  });
});

import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useCaptureKeys } from "@/features/capture/hooks/use-capture-keys.hook";

const press = (init: KeyboardEventInit & { consumed?: boolean }) => {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (init.consumed) e.preventDefault();
  window.dispatchEvent(e);
};

describe("capture sheet keys", () => {
  it("hides on Escape", () => {
    const onHide = vi.fn();
    renderHook(() => useCaptureKeys({ onSave: vi.fn(), onOpenEditor: vi.fn(), onHide }));
    press({ key: "Escape" });
    expect(onHide).toHaveBeenCalled();
  });

  it("leaves the sheet alone when a field has already used Escape", () => {
    // The tag input consumes Escape to clear what you half-typed. Before this check, the
    // same keystroke also discarded the clipboard capture and everything you had set.
    const onHide = vi.fn();
    renderHook(() => useCaptureKeys({ onSave: vi.fn(), onOpenEditor: vi.fn(), onHide }));
    press({ key: "Escape", consumed: true });
    expect(onHide).not.toHaveBeenCalled();
  });

  it("still saves on ⌘↵", () => {
    const onSave = vi.fn();
    renderHook(() => useCaptureKeys({ onSave, onOpenEditor: vi.fn(), onHide: vi.fn() }));
    press({ key: "Enter", metaKey: true });
    expect(onSave).toHaveBeenCalled();
  });
});

import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedGuard } from "@/features/editor/components/unsaved-guard/hooks/use-unsaved-guard.hook";
import { useEditorShortcuts } from "@/features/editor/hooks/use-editor-shortcuts.hook";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const fireBeforeUnload = () => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);

  return e.defaultPrevented;
};

describe("useUnsavedGuard", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("lets a clean document close without a word", () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    const { result } = renderHook(() => useUnsavedGuard(false));
    expect(fireBeforeUnload()).toBe(false);
    expect(result.current.prompting).toBe(false);
    act(() => result.current.closeNow());
    expect(close).toHaveBeenCalled();
  });

  it("blocks the close on unsaved changes and asks instead", () => {
    const { result } = renderHook(() => useUnsavedGuard(true));
    act(() => {
      fireBeforeUnload();
    });
    expect(result.current.prompting).toBe(true);
  });

  it("disarms itself before its own close, so discard actually closes", () => {
    // The bug this pins: `beforeunload` fires again on our own window.close(). Waiting
    // for React to detach the listener left it armed, the close was blocked a second
    // time, and the window just sat there looking stuck.
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    const { result } = renderHook(() => useUnsavedGuard(true));
    expect(fireBeforeUnload()).toBe(true);
    act(() => result.current.closeNow());
    expect(close).toHaveBeenCalledTimes(1);
    expect(fireBeforeUnload()).toBe(false);
  });
});

describe("useEditorShortcuts", () => {
  beforeEach(() => mockMarascaApi());
  const press = (key: string, prevent = false) => {
    const e = new KeyboardEvent("keydown", { key, cancelable: true });
    if (prevent) e.preventDefault();
    window.dispatchEvent(e);
  };

  it("routes Escape to the close handler", () => {
    const onEscape = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave: vi.fn(), onEscape }));
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores an Escape a dropdown already used", () => {
    // Dismissing a project suggestion list must not also close the window.
    const onEscape = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave: vi.fn(), onEscape }));
    press("Escape", true);
    press("a");
    expect(onEscape).not.toHaveBeenCalled();
  });

  /** Escape as it really arrives: on a focused element, bubbling up to the window. */
  const pressIn = (el: Element) =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );

  it("leaves an Escape inside the markdown editor to CodeMirror", () => {
    // Tab indents there, so Escape-then-Tab is the only keyboard way out. Closing the
    // window on that Escape is what used to make it unreachable.
    const onEscape = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave: vi.fn(), onEscape }));
    document.body.innerHTML =
      '<div class="cm-editor"><div class="cm-scroller"><div class="cm-content" contenteditable="true"></div></div></div>';
    pressIn(document.querySelector(".cm-content")!);
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("still closes on Escape from the title field", () => {
    const onEscape = vi.fn();
    renderHook(() => useEditorShortcuts({ onSave: vi.fn(), onEscape }));
    document.body.innerHTML = '<label><input aria-label="Title" /></label>';
    pressIn(document.querySelector("input")!);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

import { renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useMainShortcuts } from "@/features/main/hooks/use-main-shortcuts.hook";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const handlers = () => ({
  onSearch: vi.fn(),
  onTrash: vi.fn(),
  onSettings: vi.fn(),
  onHistory: vi.fn(),
});

const key = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));

describe("main window shortcuts", () => {
  it("acts once when the menu and the keypress both arrive", () => {
    // Every one of these keys is a menu accelerator as well as a window keydown. Where
    // both are delivered — Windows and Linux — ⌘Y used to toggle history twice, so the
    // drawer never opened, and ⌘⌫ trashed twice, the second call failing into a toast.
    const h = handlers();
    const { emit } = mockVaultApi();
    renderHook(() => useMainShortcuts(h));
    key({ key: "y", ctrlKey: true });
    emit("shortcut", "history");
    expect(h.onHistory).toHaveBeenCalledTimes(1);
  });

  it("still acts on a second, deliberate press", () => {
    const h = handlers();
    mockVaultApi();
    renderHook(() => useMainShortcuts(h));
    key({ key: "y", ctrlKey: true });
    const later = Date.now() + 400;
    vi.spyOn(Date, "now").mockReturnValue(later);
    key({ key: "y", ctrlKey: true });
    expect(h.onHistory).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("leaves ⌘⌫ alone while you are typing", () => {
    const h = handlers();
    mockVaultApi();
    renderHook(() => useMainShortcuts(h));
    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", ctrlKey: true, bubbles: true }),
    );
    expect(h.onTrash).not.toHaveBeenCalled();
    input.remove();
  });
});

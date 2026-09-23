import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHotkeyWarning } from "@/features/main/hooks/use-hotkey-warning.hook";
import { acceleratorLabel } from "@/helpers";
import { useToast } from "@/stores/toast";
import { mockVaultApi } from "../../helpers/mock-vault-api";

beforeEach(() => {
  useToast.getState().dismiss();
});

describe("useHotkeyWarning", () => {
  it("says the shortcut is taken, and offers the way to change it", async () => {
    mockVaultApi({ "hotkey:status": { accelerator: "Control+Alt+V", active: false } });
    const openSettings = vi.fn();
    renderHook(() => useHotkeyWarning(openSettings));

    await vi.waitFor(() => expect(useToast.getState().toast).not.toBeNull());
    const toast = useToast.getState().toast;
    expect(toast?.message).toBe(
      `${acceleratorLabel("Control+Alt+V")} is taken by another app. Pick a different shortcut.`,
    );
    expect(toast?.action?.label).toBe("Open Settings");
    act(() => void toast?.action?.run());
    expect(openSettings).toHaveBeenCalled();
  });

  it("stays quiet when the shortcut is bound, or was never asked for", async () => {
    for (const status of [
      { accelerator: "Control+Alt+V", active: true },
      { accelerator: null, active: false },
    ]) {
      const { invoke } = mockVaultApi({ "hotkey:status": status });
      const { unmount } = renderHook(() => useHotkeyWarning(vi.fn()));
      await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("hotkey:status"));
      await act(async () => undefined);
      expect(useToast.getState().toast).toBeNull();
      unmount();
    }
  });
});

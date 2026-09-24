import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useSettings } from "@/features/settings/hooks/use-settings.hook";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { VaultConfig } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const config: VaultConfig = {
  root: "/v",
  remote: "nunu/vault2",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
  assetDirs: { concorde: "/Users/nunu/Coding/concorde" },
};

describe("useSettings", () => {
  it("writes a patch through main and keeps the returned config", async () => {
    const { invoke } = mockVaultApi({
      "vault:updateConfig": () => ({ ...config, hotkey: "Alt+Super+V" }),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    let ok = false;
    await act(async () => {
      ok = await result.current.update({ hotkey: "Alt+Super+V" });
    });
    expect(ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith("vault:updateConfig", { hotkey: "Alt+Super+V" });
    expect(useApp.getState().config?.hotkey).toBe("Alt+Super+V");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a refused hotkey and leaves the config alone", async () => {
    mockVaultApi({ "vault:updateConfig": new Error("Alt+Space is taken by another app") });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await act(async () => {
      await result.current.update({ hotkey: "Alt+Space" });
    });
    expect(result.current.error).toBe("Alt+Space is taken by another app");
    expect(useApp.getState().config?.hotkey).toBe("Control+Alt+V");
  });

  it("forgets an image folder and empties the trash", async () => {
    const { invoke } = mockVaultApi({
      "vault:updateConfig": () => ({ ...config, assetDirs: {} }),
      "trash:purge": () => ({ removed: 2, assets: ["p/assets/a.gif"] }),
      "trash:list": () => [],
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await act(async () => {
      await result.current.forgetAssetDir("concorde");
    });
    expect(invoke).toHaveBeenCalledWith("vault:updateConfig", { assetDirs: {} });
    await act(() => result.current.emptyTrash());
    expect(invoke).toHaveBeenCalledWith("trash:purge");
    expect(useToast.getState().toasts.at(-1)?.message).toContain(
      "deleted 2 docs and 1 image forever",
    );
  });

  it("says nothing when the user cancels emptying the trash", async () => {
    const { invoke } = mockVaultApi({ "trash:purge": () => ({ removed: 0, assets: [] }) });
    useApp.setState({ config });
    useToast.getState().dismiss();
    const { result } = renderHook(() => useSettings());
    await act(() => result.current.emptyTrash());
    expect(invoke).toHaveBeenCalledWith("trash:purge");
    expect(invoke).not.toHaveBeenCalledWith("trash:list");
    expect(useToast.getState().toasts).toEqual([]);
    expect(result.current.busy).toBeNull();
  });

  it("says when the shortcut on screen isn't bound because another app holds it", async () => {
    mockVaultApi({ "hotkey:status": { accelerator: "Control+Alt+V", active: false } });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await vi.waitFor(() => expect(result.current.hotkeyTaken).toBe(true));
  });

  it("does not call a shortcut taken when it was simply never registered", async () => {
    // No vault open at launch, so nothing asked for it: that is not another app's doing.
    const { invoke } = mockVaultApi({ "hotkey:status": { accelerator: null, active: false } });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("hotkey:status"));
    expect(result.current.hotkeyTaken).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useSettings } from "@/features/settings/hooks/use-settings.hook";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

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
    const { invoke } = mockMarascaApi({
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
    mockMarascaApi({ "vault:updateConfig": new Error("Alt+Space is taken by another app") });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await act(async () => {
      await result.current.update({ hotkey: "Alt+Space" });
    });
    // Said under the setting that failed, not under whichever row shows errors.
    expect(result.current.errorFor("hotkey")).toBe("Alt+Space is taken by another app");
    expect(result.current.errorFor("pushDebounceMs")).toBeNull();
    expect(useApp.getState().config?.hotkey).toBe("Control+Alt+V");
  });

  it("forgets an image folder and empties the trash", async () => {
    const { invoke } = mockMarascaApi({
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
      "deleted 2 docs and 1 image from the vault",
    );
  });

  it("points the vault at the folder it was moved to, and says where that is", async () => {
    const moved = { ...config, root: "/Users/nunu/Files/vault" };
    const { invoke } = mockMarascaApi({
      "vault:relocate": moved,
      "vault:index": { docs: [], projects: [], tags: [], orphans: 0, headSha: null, scannedAt: 1 },
      "trash:list": [],
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await act(() => result.current.relocate());

    expect(invoke).toHaveBeenCalledWith("vault:relocate");
    // Everything but the folder is the vault's own, and comes along.
    expect(useApp.getState().config).toEqual(moved);
    expect(result.current.errorFor("root")).toBeNull();
    expect(useToast.getState().toasts.at(-1)?.message).toBe("Vault folder is now ~/Files/vault");
  });

  it("says why a folder was refused beside the vault folder, and keeps the old one", async () => {
    mockMarascaApi({
      "vault:relocate": new Error(
        "Error invoking remote method 'vault:relocate': Error: “Files” isn’t your vault: it has no git history.",
      ),
    });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await act(() => result.current.relocate());

    expect(result.current.errorFor("root")).toBe(
      "“Files” isn’t your vault: it has no git history.",
    );
    expect(result.current.errorFor("hotkey")).toBeNull();
    expect(result.current.busy).toBeNull();
    expect(useApp.getState().config?.root).toBe("/v");
  });

  it("says nothing when no folder was chosen", async () => {
    mockMarascaApi({ "vault:relocate": null });
    useApp.setState({ config });
    useToast.setState({ toasts: [] });
    const { result } = renderHook(() => useSettings());
    await act(() => result.current.relocate());

    expect(useToast.getState().toasts).toEqual([]);
    expect(result.current.errorFor("root")).toBeNull();
    expect(useApp.getState().config?.root).toBe("/v");
  });

  it("says nothing when the user cancels emptying the trash", async () => {
    const { invoke } = mockMarascaApi({ "trash:purge": () => ({ removed: 0, assets: [] }) });
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
    mockMarascaApi({ "hotkey:status": { accelerator: "Control+Alt+V", active: false } });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await vi.waitFor(() => expect(result.current.hotkeyTaken).toBe(true));
  });

  it("does not call a shortcut taken when it was simply never registered", async () => {
    // No vault open at launch, so nothing asked for it: that is not another app's doing.
    const { invoke } = mockMarascaApi({ "hotkey:status": { accelerator: null, active: false } });
    useApp.setState({ config });
    const { result } = renderHook(() => useSettings());
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith("hotkey:status"));
    expect(result.current.hotkeyTaken).toBe(false);
  });
});

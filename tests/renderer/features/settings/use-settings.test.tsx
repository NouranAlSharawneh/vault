// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { VaultConfig } from "@shared/types";
import { useSettings } from "@/features/settings/hooks/use-settings.hook";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
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
    expect(useToast.getState().toast?.message).toContain("2 docs gone for good, with 1 image");
  });
});

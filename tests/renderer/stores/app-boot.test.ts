// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useApp } from "@/stores/app";
import type { IndexSnapshot, SyncStatus, VaultConfig } from "@shared/types";
import { mockVaultApi } from "../helpers/mock-vault-api";

const config: VaultConfig = {
  root: "/Users/nunu/Documents/vault",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "claude",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};
const index: IndexSnapshot = {
  docs: [],
  projects: [],
  tags: [],
  orphans: 0,
  headSha: null,
  scannedAt: 1,
};
const sync: SyncStatus = {
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: "nunu/vault",
  conflicts: 0,
  failure: null,
};
const answers = {
  "auth:state": { status: "signed-in", user: null, method: "pat" },
  "vault:config": config,
  "app:platform": "darwin",
  "vault:index": index,
  "sync:status": sync,
  "trash:list": [],
};

beforeEach(() => {
  useApp.setState({ index: null, sync: null, trash: [], vaultError: null, ready: false });
});

describe("boot", () => {
  it("keeps why the vault would not open, instead of passing it off as an empty one", async () => {
    mockVaultApi({ ...answers, "vault:index": new Error("EACCES: permission denied") });
    await useApp.getState().boot();

    expect(useApp.getState().vaultError).toBe("EACCES: permission denied");
    expect(useApp.getState().index).toBeNull();
    expect(useApp.getState().ready).toBe(true);
  });

  it("does not throw the library away because the trash couldn't be listed", async () => {
    mockVaultApi({ ...answers, "trash:list": new Error("ENOENT: .trash") });
    await useApp.getState().boot();

    expect(useApp.getState().index).toBe(index);
    expect(useApp.getState().sync).toBe(sync);
    expect(useApp.getState().trash).toEqual([]);
    expect(useApp.getState().vaultError).toBeNull();
  });

  it("leaves sync unknown rather than guessing when its status fails", async () => {
    mockVaultApi({ ...answers, "sync:status": new Error("boom") });
    await useApp.getState().boot();

    expect(useApp.getState().index).toBe(index);
    expect(useApp.getState().sync).toBeNull();
  });
});

describe("reopenVault", () => {
  it("clears the failure once the vault opens, and loads the rest", async () => {
    const { invoke } = mockVaultApi({ ...answers, "vault:reopen": index });
    useApp.setState({ config, vaultError: "EACCES: permission denied" });
    await useApp.getState().reopenVault();

    expect(invoke).toHaveBeenCalledWith("vault:reopen");
    expect(useApp.getState().vaultError).toBeNull();
    expect(useApp.getState().index).toBe(index);
    expect(useApp.getState().sync).toBe(sync);
  });

  it("keeps the newest reason when it still won't open", async () => {
    mockVaultApi({ ...answers, "vault:reopen": new Error("The folder isn’t there any more.") });
    useApp.setState({ config, vaultError: "EACCES: permission denied" });
    await useApp.getState().reopenVault();

    expect(useApp.getState().vaultError).toBe("The folder isn’t there any more.");
  });
});

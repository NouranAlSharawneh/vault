import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dir = { path: "" };
vi.mock("electron", () => ({ app: { getPath: () => dir.path } }));

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_HOTKEY } from "@shared/constants";
import type { VaultConfig } from "@shared/types";

const vault = (hotkey: string): VaultConfig => ({
  root: "/vault",
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey,
  pushDebounceMs: 1000,
});

import type * as SettingsStore from "@main/store/settings.store";

/** The store caches in module scope, so each test needs its own copy of the module. */
async function load(): Promise<typeof SettingsStore> {
  vi.resetModules();

  return import("@main/store/settings.store");
}

const write = (settings: unknown): void =>
  writeFileSync(join(dir.path, "config.json"), JSON.stringify(settings));

describe("settings store", () => {
  beforeEach(() => {
    dir.path = mkdtempSync(join(tmpdir(), "vault-settings-"));
  });

  afterEach(() => {
    rmSync(dir.path, { recursive: true, force: true });
  });

  it("starts from defaults when there is no config file yet", async () => {
    const { getSettings } = await load();

    expect(getSettings()).toEqual({
      vault: null,
      authMethod: null,
      githubClientId: null,
      onboarded: false,
    });
  });

  it("falls back to defaults rather than throwing on a corrupt config", async () => {
    writeFileSync(join(dir.path, "config.json"), "{ this is not json");
    const { getSettings } = await load();

    expect(getSettings().onboarded).toBe(false);
  });

  it("fills in keys a config written by an older build never had", async () => {
    write({ onboarded: true });
    const { getSettings } = await load();

    expect(getSettings()).toMatchObject({ onboarded: true, authMethod: null, vault: null });
  });

  it("moves a vault off a hotkey we no longer ship", async () => {
    write({ vault: vault("Alt+Space") });
    const { getSettings } = await load();

    expect(getSettings().vault!.hotkey).toBe(DEFAULT_HOTKEY);
  });

  it("leaves a hotkey the user chose alone", async () => {
    write({ vault: vault("Control+Shift+K") });
    const { getSettings } = await load();

    expect(getSettings().vault!.hotkey).toBe("Control+Shift+K");
  });

  it("merges a patch and writes it through to disk", async () => {
    const { getSettings, updateSettings } = await load();
    updateSettings({ onboarded: true });
    updateSettings({ authMethod: "pat" });

    expect(getSettings()).toMatchObject({ onboarded: true, authMethod: "pat" });
    expect(JSON.parse(readFileSync(join(dir.path, "config.json"), "utf8"))).toMatchObject({
      onboarded: true,
      authMethod: "pat",
    });
  });

  it("is read back by the next launch", async () => {
    const first = await load();
    first.updateSettings({ vault: vault("Control+Shift+K"), onboarded: true });

    const next = await load();

    expect(next.getSettings().vault!.hotkey).toBe("Control+Shift+K");
    expect(next.getSettings().onboarded).toBe(true);
  });
});

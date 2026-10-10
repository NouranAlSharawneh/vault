import { beforeEach, describe, expect, it, vi } from "vitest";

// What decides whether a folder is "this vault" is read from three places: the settings,
// whether git can run, and the folder's own origin. Each is stubbed so every answer can
// be put in front of it; the folders themselves are real ones in the temp directory.
const settings = vi.hoisted(() => ({
  value: { vault: null as null | Record<string, unknown> },
  written: [] as unknown[],
}));
const git = vi.hoisted(() => ({ state: "ready", origins: new Map<string, string>() }));

vi.mock("@main/store/settings.store", () => ({
  getSettings: () => settings.value,
  updateSettings: (patch: { vault: Record<string, unknown> }) => {
    settings.written.push(patch);
    settings.value = { ...settings.value, ...patch };
  },
}));
vi.mock("@main/services/git/git-status.service", () => ({
  refreshGitStatus: async () => ({ state: git.state }),
}));
vi.mock("@main/services/git/git.service", () => ({
  GitService: { originOf: async (dir: string) => git.origins.get(dir) ?? null },
}));

import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { relocateVault } from "@main/app/ipc/relocate-vault";
import type { session as appSession } from "@main/app/session/session";

const vault = {
  root: "/Users/nunu/Documents/vault2",
  remote: "Nunu/vault2",
  branch: "main",
  lastProject: "Freelance",
  lastSource: "claude",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
  assetDirs: { atlas: "/Users/nunu/Projects/atlas/img" },
};

/** A folder in the temp directory, with whichever of `.git` and `.vault` it should have. */
function folder(...inside: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "marasca-relocate-"));
  for (const name of inside) mkdirSync(join(dir, name));

  return dir;
}

/** The session, as far as relocating goes: what is open, and what it was asked to open. */
function fakeSession(open: { root: string } | null = { root: vault.root }) {
  const s = {
    vault: open,
    /** The one folder that won't open, and why. */
    unopenable: null as { root: string; error: Error } | null,
    openVault: vi.fn(async (config: { root: string }) => {
      s.vault = null;
      if (s.unopenable?.root === config.root) throw s.unopenable.error;
      s.vault = config;

      return config;
    }),
  };

  return s;
}

const relocate = (s: ReturnType<typeof fakeSession>, dir: string) =>
  relocateVault(s as unknown as typeof appSession, dir);

beforeEach(() => {
  settings.value = { vault: { ...vault } };
  settings.written = [];
  git.state = "ready";
  git.origins.clear();
});

describe("pointing Marasca at a vault folder that was moved", () => {
  it("opens it from there and keeps everything else about the vault", async () => {
    const moved = folder(".git");
    git.origins.set(moved, "https://github.com/Nunu/vault2.git");
    const session = fakeSession();

    const next = await relocate(session, moved);

    expect(next).toEqual({ ...vault, root: moved });
    expect(session.openVault).toHaveBeenCalledWith(next);
    expect(settings.written).toEqual([{ vault: next }]);
  });

  it("knows the repo however its origin is spelled", async () => {
    const moved = folder(".git");
    git.origins.set(moved, "git@github.com:nunu/VAULT2.git");

    await expect(relocate(fakeSession(), moved)).resolves.toMatchObject({ root: moved });
  });

  it("refuses a folder with no git history, and leaves the vault as it was", async () => {
    const session = fakeSession();
    const plain = folder();

    await expect(relocate(session, plain)).rejects.toThrow(/isn’t your vault: it has no git/);
    expect(session.openVault).not.toHaveBeenCalled();
    expect(settings.written).toEqual([]);
  });

  it("refuses another project's repo, naming both", async () => {
    const other = folder(".git");
    git.origins.set(other, "https://github.com/nunu/website.git");
    const session = fakeSession();

    await expect(relocate(session, other)).rejects.toThrow(
      /is a git repo for nunu\/website, not Nunu\/vault2/,
    );
    expect(session.openVault).not.toHaveBeenCalled();
    expect(settings.written).toEqual([]);
  });

  it("refuses a repo that has no origin when the vault is on GitHub", async () => {
    await expect(relocate(fakeSession(), folder(".git", ".vault"))).rejects.toThrow(
      /isn’t connected to Nunu\/vault2/,
    );
  });

  it("does nothing when the folder is the one already open", async () => {
    const session = fakeSession();

    await expect(relocate(session, vault.root)).resolves.toEqual(vault);
    expect(session.openVault).not.toHaveBeenCalled();
    expect(settings.written).toEqual([]);
  });

  it("opens the same folder when it is back but the vault never opened", async () => {
    const back = folder(".git");
    git.origins.set(back, "https://github.com/nunu/vault2");
    settings.value = { vault: { ...vault, root: back } };
    const session = fakeSession(null);

    await relocate(session, back);

    expect(session.openVault).toHaveBeenCalledTimes(1);
  });

  it("says git is what's missing rather than blaming the folder", async () => {
    git.state = "missing";
    const session = fakeSession();

    await expect(relocate(session, folder(".git"))).rejects.toThrow(/needs git/);
    expect(session.openVault).not.toHaveBeenCalled();
  });
});

describe("a local-only vault, which has no repo to be known by", () => {
  beforeEach(() => {
    settings.value = { vault: { ...vault, remote: null } };
  });

  it("is known by the .vault folder Marasca keeps in it", async () => {
    const moved = folder(".git", ".vault");

    await expect(relocate(fakeSession(), moved)).resolves.toMatchObject({
      root: moved,
      remote: null,
    });
  });

  it("is not just any git repo", async () => {
    const session = fakeSession();

    await expect(relocate(session, folder(".git"))).rejects.toThrow(/not one Marasca has used/);
    expect(session.openVault).not.toHaveBeenCalled();
  });
});

describe("a folder that passes the checks and still won't open", () => {
  it("puts back the vault that was open, and changes no setting", async () => {
    const here = folder(".git");
    const moved = folder(".git");
    git.origins.set(moved, "https://github.com/nunu/vault2.git");
    const was = { ...vault, root: here };
    settings.value = { vault: was };
    const session = fakeSession({ root: here });
    session.unopenable = { root: moved, error: new Error("EACCES: permission denied") };

    await expect(relocate(session, moved)).rejects.toThrow("EACCES: permission denied");

    expect(session.openVault).toHaveBeenLastCalledWith(was);
    expect(session.vault).toBe(was);
    expect(settings.written).toEqual([]);
  });

  it("does not recreate the old folder when that one is gone", async () => {
    const moved = folder(".git");
    git.origins.set(moved, "https://github.com/nunu/vault2.git");
    const session = fakeSession();
    session.unopenable = { root: moved, error: new Error("EACCES: permission denied") };

    await expect(relocate(session, moved)).rejects.toThrow("EACCES: permission denied");

    // Opening creates a missing root: asked to, it would leave an empty vault behind.
    expect(session.openVault).toHaveBeenCalledTimes(1);
  });
});

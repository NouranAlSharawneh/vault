import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  openEditorWindow: vi.fn(),
  showMainWindow: vi.fn(),
  session: { vault: null as null | { root: string } },
}));
vi.mock("electron", () => ({ screen: {}, BrowserWindow: {} }));
vi.mock("@main/windows", () => ({ openEditorWindow: fakes.openEditorWindow }));
vi.mock("@main/app/session/launch-route", () => ({ showMainWindow: fakes.showMainWindow }));
vi.mock("@main/app/session/session", () => ({ session: fakes.session }));

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isMarkdownFile, openMarkdownFile, vaultPathOf } from "@main/app/open-file/open-file";
import { parseTokenExpiry } from "@main/network/github/token-expiry";
import { icloudWarning } from "@main/services/fs/icloud";
import { fitBounds } from "@main/windows/window-bounds";

const MIN = { minWidth: 860, minHeight: 560 };
const LAPTOP = { x: 0, y: 25, width: 1512, height: 920 };
const MONITOR = { x: 1512, y: 0, width: 2560, height: 1415 };

describe("where a window reopens", () => {
  it("goes back where it was, on the screen it was on", () => {
    const saved = { x: 1700, y: 100, width: 1400, height: 900 };
    expect(fitBounds(saved, [LAPTOP, MONITOR], MIN)).toEqual(saved);
  });

  it("keeps its size but not its place when that screen is gone", () => {
    // Left on the external display, which isn't plugged in this morning.
    const saved = { x: 1700, y: 100, width: 1400, height: 900 };
    expect(fitBounds(saved, [LAPTOP], MIN)).toEqual({ width: 1400, height: 900 });
  });

  it("is cut down to fit a smaller screen, never below its minimum", () => {
    const saved = { x: 20, y: 40, width: 2400, height: 1300 };
    expect(fitBounds(saved, [LAPTOP], MIN)).toEqual({ x: 0, y: 25, width: 1512, height: 920 });
    expect(fitBounds({ ...saved, width: 300, height: 200 }, [LAPTOP], MIN)).toMatchObject({
      width: 860,
      height: 560,
    });
  });

  it("opens as new with nothing saved, and an editor takes the size only", () => {
    expect(fitBounds(undefined, [LAPTOP], MIN)).toBeNull();
    const saved = { x: 100, y: 100, width: 1000, height: 700 };
    expect(fitBounds(saved, [LAPTOP], { minWidth: 720, minHeight: 480 }, false)).toEqual({
      width: 1000,
      height: 700,
    });
  });
});

describe("a pasted token's expiry", () => {
  it("reads GitHub's header, in UTC or with an offset", () => {
    expect(parseTokenExpiry("2026-10-06 00:00:00 UTC")).toBe(Date.parse("2026-10-06T00:00:00Z"));
    expect(parseTokenExpiry("2026-10-06 00:00:00 -0700")).toBe(Date.parse("2026-10-06T07:00:00Z"));
  });

  it("is nothing for a token that doesn't expire", () => {
    expect(parseTokenExpiry(undefined)).toBeNull();
    expect(parseTokenExpiry("")).toBeNull();
    expect(parseTokenExpiry("soon")).toBeNull();
  });
});

describe("a vault folder iCloud also syncs", () => {
  const home = "/Users/nunu";
  const cloudDocs = join(home, "Library", "Mobile Documents", "com~apple~CloudDocs");

  it("warns inside iCloud Drive", () => {
    expect(icloudWarning(join(cloudDocs, "vault"), home, () => false)).toMatch(/iCloud Drive/);
  });

  it("warns in Documents and Desktop only when iCloud syncs them", () => {
    const synced = (p: string) => p === join(cloudDocs, "Documents");
    expect(icloudWarning(join(home, "Documents", "vault"), home, synced)).toMatch(
      /syncs your Documents folder/,
    );
    expect(icloudWarning(join(home, "Desktop", "notes"), home, synced)).toMatch(/Desktop/);
    expect(icloudWarning(join(home, "Documents", "vault"), home, () => false)).toBeNull();
  });

  it("is quiet anywhere else", () => {
    expect(icloudWarning(join(home, "vault"), home, () => true)).toBeNull();
    expect(icloudWarning(join(home, "Documents-old", "vault"), home, () => true)).toBeNull();
  });
});

describe("markdown files from outside", () => {
  it("takes .md and .markdown, nothing else", () => {
    expect(isMarkdownFile("/x/Notes.MD")).toBe(true);
    expect(isMarkdownFile("/x/a.markdown")).toBe(true);
    expect(isMarkdownFile("/x/a.txt")).toBe(false);
  });

  it("opens one in the vault as itself, and one in the trash or outside as a copy", () => {
    const root = "/Users/nunu/vault";
    expect(vaultPathOf(join(root, "atlas-api", "spec.md"), root)).toBe("atlas-api/spec.md");
    expect(vaultPathOf(join(root, ".trash", "old.md"), root)).toBeNull();
    expect(vaultPathOf("/Users/nunu/Downloads/readme.md", root)).toBeNull();
    expect(vaultPathOf("/Users/nunu/vault-2/readme.md", root)).toBeNull();
  });

  it("opens a vault document as itself, and anything else as a new one, untouched", async () => {
    const home = mkdtempSync(join(tmpdir(), "marasca-open-"));
    const root = join(home, "vault");
    const outside = join(home, "readme.md");
    writeFileSync(outside, "# Readme\n");
    fakes.session.vault = { root };

    await openMarkdownFile(join(root, "atlas", "spec.md"));
    expect(fakes.openEditorWindow).toHaveBeenLastCalledWith({ path: "atlas/spec.md" });

    await openMarkdownFile(outside);
    expect(fakes.openEditorWindow).toHaveBeenLastCalledWith({
      draft: { body: "# Readme\n", sourcePath: outside },
    });
  });

  it("turns down a file too big to be a note, and waits for a vault that isn't there", async () => {
    const home = mkdtempSync(join(tmpdir(), "marasca-open-"));
    const big = join(home, "log.md");
    writeFileSync(big, "x".repeat(2 * 1024 * 1024 + 1));
    fakes.session.vault = { root: join(home, "vault") };
    await expect(openMarkdownFile(big)).rejects.toThrow(/too large/);

    fakes.session.vault = null;
    fakes.openEditorWindow.mockClear();
    await openMarkdownFile(big);
    expect(fakes.showMainWindow).toHaveBeenCalled();
    expect(fakes.openEditorWindow).not.toHaveBeenCalled();
  });
});

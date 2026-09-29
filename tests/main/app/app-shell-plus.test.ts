import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ nativeImage: {}, app: {}, BrowserWindow: {}, dialog: {}, shell: {} }));

import { diagnosticsText } from "@main/app/diagnostics/diagnostics";
import { updateMessage } from "@main/app/menu/check-updates-from-menu";
import { createSyncNudge } from "@main/app/session/sync-nudge";
import { shortcutGroups } from "@main/app/shortcuts/shortcut-groups";
import { trayBitmap } from "@main/app/tray/tray-icon";
import { recentDocs, syncLine, trayMenu } from "@main/app/tray/tray-menu";
import { appMenu } from "@main/data/menu.data";
import type { DocMeta, SyncStatus } from "@shared/types";

const sync = (over: Partial<SyncStatus> = {}): SyncStatus => ({
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: "nunu/vault",
  conflicts: 0,
  failure: null,
  ...over,
});

const doc = (path: string, created: string): DocMeta =>
  ({ path, title: path.toUpperCase(), created, mtime: 0 }) as DocMeta;

describe("the menu bar item", () => {
  it("leads with where sync stands, in words", () => {
    expect(syncLine(sync(), "nunu/vault")).toBe("Pushed to GitHub");
    expect(syncLine(sync({ state: "pending", ahead: 2 }), "nunu/vault")).toBe("2 waiting to push");
    expect(syncLine(sync({ state: "offline" }), "nunu/vault")).toMatch(/Offline/);
    expect(syncLine(sync({ conflicts: 1 }), "nunu/vault")).toMatch(/1 to review/);
    expect(syncLine(null, null)).toBe("Local vault — nothing to push");
  });

  it("offers capture, the window, the documents captured last, and quit", () => {
    const items = trayMenu({
      hasVault: true,
      remote: "nunu/vault",
      sync: sync(),
      recent: [{ path: "a.md", title: "Alpha" }],
    });
    const labels = items.map((i) => ("label" in i ? i.label : "---"));
    expect(labels).toEqual([
      "Pushed to GitHub",
      "---",
      "Capture Clipboard",
      "Open Marasca",
      "---",
      "Recent",
      "Alpha",
      "---",
      "Quit Marasca",
    ]);
    expect(items.find((i) => i.kind === "doc")).toEqual({
      kind: "doc",
      label: "Alpha",
      path: "a.md",
    });
  });

  it("can't capture with no vault, and has no Recent to show", () => {
    const items = trayMenu({ hasVault: false, remote: null, sync: null, recent: [] });
    const capture = items.find((i) => i.kind === "action" && i.action === "capture");
    expect(capture && "enabled" in capture && capture.enabled).toBe(false);
    expect(items.some((i) => "label" in i && i.label === "Recent")).toBe(false);
  });

  it("lists the newest captures first, a handful of them", () => {
    const docs = Array.from({ length: 8 }, (_, i) => doc(`d${i}.md`, `2026-09-0${i + 1}`));
    expect(recentDocs(docs, 3).map((d) => d.path)).toEqual(["d7.md", "d6.md", "d5.md"]);
  });

  it("draws the logo as black pixels on transparent, centred at 2×", () => {
    const rows = ["S.", ".S"];
    const bitmap = trayBitmap(rows, 2);
    expect(bitmap.length).toBe(32 * 32 * 4);
    const alpha = [...bitmap].filter((_, i) => i % 4 === 3);
    // Two cells, each 2×2 pixels.
    expect(alpha.filter((a) => a === 255)).toHaveLength(8);
    // Every colour channel stays black.
    expect([...bitmap].filter((v, i) => i % 4 !== 3 && v !== 0)).toEqual([]);
  });
});

describe("diagnostics", () => {
  const base = {
    app: "0.0.2",
    electron: "44.0.0",
    chrome: "140",
    node: "24",
    os: "darwin 25.6.0",
    arch: "arm64",
    home: "/Users/nunu",
    git: { state: "ready", version: "2.50.1", binary: "/usr/bin/git", source: "apple" } as const,
    vault: {
      root: "/Users/nunu/Documents/vault",
      remote: "nunu/vault",
      branch: "main",
      lastProject: null,
      lastSource: "manual",
      hotkey: "Control+Alt+V",
      pushDebounceMs: 3000,
    } as const,
    vaultOpen: true,
    vaultError: null,
    docs: 42,
    sync: sync({ lastError: "fatal: unable to access /Users/nunu/Documents/vault/.git" }),
    auth: {
      status: "signed-in",
      user: { login: "nunu", name: null, avatarUrl: "" },
      method: "pat",
    },
    now: Date.parse("2026-09-29T12:00:00Z"),
  } as const;

  it("says what a helper asks for first, with paths shortened to ~", () => {
    const text = diagnosticsText(base as never);
    expect(text).toContain("Marasca 0.0.2");
    expect(text).toContain("Vault: ~/Documents/vault · open, 42 documents");
    expect(text).toContain("Repository: nunu/vault");
    expect(text).toContain("Last error: fatal: unable to access ~/Documents/vault/.git");
    expect(text).not.toContain("/Users/nunu");
  });

  it("names how you signed in, never with what", () => {
    const text = diagnosticsText(base as never);
    expect(text).toContain("GitHub: signed-in via pat as nunu");
    expect(text).not.toMatch(/gh[op]_|github_pat_/);
  });
});

describe("Help ▸ Keyboard Shortcuts", () => {
  it("comes from the menus, the capture shortcut as it is now included", () => {
    const groups = shortcutGroups(appMenu("Control+Shift+Space", { mac: true, dev: false }));
    const file = groups.find((g) => g.title === "File");
    expect(file?.items).toContainEqual({
      label: "Capture from Clipboard",
      accelerator: "Control+Shift+Space",
    });
    expect(groups.find((g) => g.title === "Help")?.items).toContainEqual({
      label: "Keyboard Shortcuts",
      accelerator: "CmdOrCtrl+/",
    });
    // Sections that are the system's own (Edit, Window) have nothing of ours to list.
    expect(groups.map((g) => g.title)).not.toContain(undefined);
    expect(groups.find((g) => g.title === "Editor")?.items[0]?.accelerator).toBe("CmdOrCtrl+F");
  });
});

describe("Check for Updates…", () => {
  it("offers the download only when there is something newer", () => {
    expect(
      updateMessage({ status: "available", current: "0.0.2", latest: "0.1.0", url: "u" }),
    ).toMatchObject({ message: "Marasca 0.1.0 is available", url: "u" });
    expect(updateMessage({ status: "up-to-date", current: "0.1.0", latest: "0.1.0" }).url).toBe(
      undefined,
    );
  });
});

describe("retrying sync when the network may be back", () => {
  it("runs once for a burst of wake, unlock and online", () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const { nudge } = createSyncNudge(run, 2000);
    nudge();
    nudge();
    vi.advanceTimersByTime(1500);
    nudge();
    vi.advanceTimersByTime(1999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

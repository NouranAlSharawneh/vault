import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateInstall } from "@shared/types";

const m = vi.hoisted(() => ({
  sent: [] as UpdateInstall[],
  blocker: null as string | null,
  prepared: 0,
  prepare: null as null | (() => Promise<void>),
  staging: "",
  documentsClosed: true,
  helper: vi.fn(async (_: unknown) => undefined),
  quit: vi.fn(),
  progress: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
    getVersion: () => "0.0.4",
    getPath: (name: string) =>
      name === "exe" ? "/Applications/Marasca.app/Contents/MacOS/Marasca" : "/logs",
    quit: m.quit,
  },
}));
vi.mock("@main/windows/broadcast", () => ({
  broadcast: (_: string, payload: UpdateInstall) => m.sent.push(payload),
}));
vi.mock("@main/windows/main.window", () => ({
  getMainWindow: () => ({ setProgressBar: m.progress }),
}));
vi.mock("@main/windows/close-document-windows", () => ({
  closeDocumentWindows: async () => m.documentsClosed,
}));
vi.mock("@main/services/updates/app-bundle", async (original) => ({
  ...(await original<object>()),
  inPlaceBlocker: async () => m.blocker,
}));
vi.mock("@main/services/updates/prepare-update", () => ({
  DOWNLOAD_DIR_PREFIX: "marasca-update-",
  prepareUpdate: async ({
    version,
    report,
  }: {
    version: string;
    report: (s: UpdateInstall) => void;
  }) => {
    m.prepared++;
    report({ phase: "downloading", version, received: 0, total: 100 });
    report({ phase: "downloading", version, received: 50, total: 100 });
    report({ phase: "downloading", version, received: 50.5, total: 100 });
    await m.prepare?.();
    report({ phase: "installing", version });

    return m.staging;
  },
}));
vi.mock("@main/services/updates/update-helper", () => ({ spawnUpdateHelper: m.helper }));

import {
  installUpdate,
  resetUpdateInstall,
  updateInstallState,
} from "@main/app/updates/update-install";

beforeEach(() => {
  resetUpdateInstall();
  m.sent = [];
  m.blocker = null;
  m.prepared = 0;
  m.prepare = null;
  m.documentsClosed = true;
  m.helper.mockClear();
  m.quit.mockClear();
  // A staging folder that exists, as `stageUpdate` leaves it.
  m.staging = mkdtempSync(join(tmpdir(), "marasca-install-test-"));
  mkdirSync(join(m.staging, "Marasca.app"));
});

describe("installUpdate", () => {
  it("downloads, stages, hands the swap to the helper and quits", async () => {
    await installUpdate("0.0.5");
    expect(m.sent.map((s) => s.phase)).toEqual([
      "downloading",
      "downloading",
      // 50.5 of 100 is still 50%: not worth a message to every window.
      "installing",
      "restarting",
    ]);
    expect(m.helper).toHaveBeenCalledWith({
      pid: process.pid,
      target: "/Applications/Marasca.app",
      staging: m.staging,
      log: join("/logs", "update.log"),
    });
    expect(m.quit).toHaveBeenCalledOnce();
    expect(m.progress).toHaveBeenCalledWith(0.5);
  });

  it("joins an install already under way", async () => {
    let release = () => undefined as void;
    m.prepare = () => new Promise<void>((r) => (release = r));
    const first = installUpdate("0.0.5");
    const second = installUpdate("0.0.5");
    expect(second).toBe(first);
    await Promise.resolve();
    release();
    await first;
    expect(m.prepared).toBe(1);
  });

  it("stops for an editor kept open, and the retry skips the download", async () => {
    m.documentsClosed = false;
    await expect(installUpdate("0.0.5")).rejects.toThrow(/Save or close the open document/);
    expect(m.quit).not.toHaveBeenCalled();
    expect(await updateInstallState()).toMatchObject({ phase: "failed", version: "0.0.5" });

    m.documentsClosed = true;
    await installUpdate("0.0.5");
    expect(m.prepared).toBe(1);
    expect(m.quit).toHaveBeenCalledOnce();
  });

  it("says why when this copy can't replace itself, and doesn't download", async () => {
    m.blocker = "Marasca can’t replace itself in /Applications without an administrator.";
    expect(await updateInstallState()).toEqual({ phase: "manual", reason: m.blocker });
    await expect(installUpdate("0.0.5")).rejects.toThrow(/administrator/);
    expect(m.prepared).toBe(0);
  });

  it("never installs this version or an older one", async () => {
    await expect(installUpdate("0.0.4")).rejects.toThrow(/already/);
    await expect(installUpdate("0.0.3")).rejects.toThrow(/already/);
    await expect(installUpdate("../../x")).rejects.toThrow(/isn’t a version/);
    expect(m.prepared).toBe(0);
  });

  it("reports a failed download, and nothing quits", async () => {
    m.prepare = async () => {
      throw new Error("The download doesn’t match its checksum. Nothing was installed.");
    };
    await expect(installUpdate("0.0.5")).rejects.toThrow(/checksum/);
    expect(m.sent.at(-1)).toEqual({
      phase: "failed",
      version: "0.0.5",
      message: "The download doesn’t match its checksum. Nothing was installed.",
    });
    expect(m.helper).not.toHaveBeenCalled();
    expect(m.quit).not.toHaveBeenCalled();
    expect(m.progress).toHaveBeenLastCalledWith(-1);
  });
});

describe("updateInstallState", () => {
  it("is ready when nothing is under way and this copy can replace itself", async () => {
    expect(await updateInstallState()).toEqual({ phase: "ready" });
  });
});

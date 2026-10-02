import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Each tool the staging runs, answered from a table; the calls are kept in order. */
const m = vi.hoisted(() => ({
  calls: [] as string[][],
  plist: {} as Record<string, string>,
  fail: new Set<string>(),
}));
vi.mock("@main/lib/run-file", () => ({
  runFile: async (file: string, args: string[]) => {
    const tool = file.split("/").pop()!;
    m.calls.push([tool, ...args]);
    if (m.fail.has(tool) || m.fail.has(`${tool} ${args[0]}`)) throw new Error(`${tool} failed`);
    if (tool === "plutil") return `${m.plist[args[1]]}\n`;
    if (tool === "rm") rmSync(args[1], { recursive: true, force: true });

    return "";
  },
}));

import { STAGING_DIR, stageUpdate } from "@main/services/updates/stage-update";

let apps = "";
let bundle = "";
let work = "";

beforeEach(() => {
  apps = mkdtempSync(join(tmpdir(), "marasca-stage-test-"));
  bundle = join(apps, "Marasca.app");
  mkdirSync(bundle);
  work = mkdtempSync(join(tmpdir(), "marasca-stage-work-"));
  m.calls = [];
  m.fail = new Set();
  m.plist = { CFBundleIdentifier: "dev.nunu.marasca", CFBundleShortVersionString: "0.0.5" };
});

const tools = () =>
  m.calls.map((c) => (c[0] === "hdiutil" ? `hdiutil ${c[1]}` : c[0])).filter((t) => t !== "rm");

describe("stageUpdate", () => {
  it("copies the app out of the DMG beside the running one, checked and unquarantined", async () => {
    const staging = await stageUpdate(join(work, "m.dmg"), bundle, "0.0.5", work);
    expect(staging).toBe(join(apps, STAGING_DIR));
    expect(existsSync(staging)).toBe(true);
    expect(tools()).toEqual([
      "hdiutil attach",
      "ditto",
      "hdiutil detach",
      "plutil",
      "plutil",
      "codesign",
      "xattr",
    ]);
    expect(m.calls.find((c) => c[0] === "ditto")).toEqual([
      "ditto",
      join(work, "mnt", "Marasca.app"),
      join(staging, "Marasca.app"),
    ]);
  });

  it("refuses an app that isn't Marasca, and leaves nothing staged", async () => {
    m.plist.CFBundleIdentifier = "com.example.other";
    await expect(stageUpdate(join(work, "m.dmg"), bundle, "0.0.5", work)).rejects.toThrow(
      /isn’t Marasca/,
    );
    expect(existsSync(join(apps, STAGING_DIR))).toBe(false);
  });

  it("refuses a version other than the one asked for", async () => {
    m.plist.CFBundleShortVersionString = "0.0.4";
    await expect(stageUpdate(join(work, "m.dmg"), bundle, "0.0.5", work)).rejects.toThrow(
      /version 0.0.4, not 0.0.5/,
    );
  });

  it("refuses an app whose signature doesn't match its files", async () => {
    m.fail.add("codesign");
    await expect(stageUpdate(join(work, "m.dmg"), bundle, "0.0.5", work)).rejects.toThrow(
      /signature/,
    );
    expect(existsSync(join(apps, STAGING_DIR))).toBe(false);
  });

  it("detaches the DMG even when the copy fails", async () => {
    m.fail.add("ditto");
    await expect(stageUpdate(join(work, "m.dmg"), bundle, "0.0.5", work)).rejects.toThrow(
      /ditto failed/,
    );
    expect(tools()).toContain("hdiutil detach");
    expect(existsSync(join(apps, STAGING_DIR))).toBe(false);
  });
});

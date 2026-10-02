import { chmodSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bundleOf, inPlaceBlocker } from "@main/services/updates/app-bundle";

const locked: string[] = [];
afterEach(() => {
  for (const p of locked.splice(0)) chmodSync(p, 0o755);
});

/** A folder holding Marasca.app, as /Applications would. */
function installed(): { folder: string; exe: string } {
  const folder = mkdtempSync(join(tmpdir(), "marasca-bundle-test-"));
  const macos = join(folder, "Marasca.app", "Contents", "MacOS");
  mkdirSync(macos, { recursive: true });

  return { folder, exe: join(macos, "Marasca") };
}

describe("bundleOf", () => {
  it("finds the .app the executable is in", () => {
    expect(bundleOf("/Applications/Marasca.app/Contents/MacOS/Marasca")).toBe(
      "/Applications/Marasca.app",
    );
    expect(bundleOf("/usr/local/bin/marasca")).toBeNull();
  });
});

describe("inPlaceBlocker", () => {
  it("lets an installed, writable copy replace itself", async () => {
    const { exe } = installed();
    expect(await inPlaceBlocker({ platform: "darwin", packaged: true, exe })).toBeNull();
  });

  it("says why a copy can't", async () => {
    const { exe } = installed();
    expect(await inPlaceBlocker({ platform: "linux", packaged: true, exe })).toMatch(/macOS/);
    expect(await inPlaceBlocker({ platform: "darwin", packaged: false, exe })).toMatch(
      /development build/,
    );
    expect(
      await inPlaceBlocker({
        platform: "darwin",
        packaged: true,
        exe: "/private/var/folders/x/AppTranslocation/ABC/d/Marasca.app/Contents/MacOS/Marasca",
      }),
    ).toMatch(/temporary copy/);
  });

  it("asks for an administrator's folder to be left alone", async () => {
    const { folder, exe } = installed();
    chmodSync(folder, 0o555);
    locked.push(folder);
    expect(await inPlaceBlocker({ platform: "darwin", packaged: true, exe })).toMatch(
      /without an administrator/,
    );
  });
});

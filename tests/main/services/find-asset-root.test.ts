import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { findAssetRoot } from "@main/services/assets";

// Spotlight answers from the real disk, which would make these non-hermetic on any Mac that
// happens to hold a matching file. The walk is what's under test here; the filter Spotlight
// hits go through is covered in spotlight.test.ts.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));

/**
 * What matters is not that a file with the right name exists somewhere, but that the folder
 * we hand back is the one the doc was actually written from — so the scoring is the subject
 * of most of these.
 */
let home: string;
const file = (path: string, bytes = 16) => {
  mkdirSync(join(home, path, ".."), { recursive: true });
  writeFileSync(join(home, path), Buffer.alloc(bytes));
};

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "vault-roots-"));
  file("concorde/docs/hero-flyin.gif");
  file("concorde/docs/cabin.png");
  // A stray copy of one of them, nested deeper, sharing nothing else with the real project.
  file("downloads/old/docs/hero-flyin.gif");
  // Noise the walk must not be derailed by.
  file("concorde/node_modules/pkg/docs/hero-flyin.gif");
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("findAssetRoot", () => {
  it("finds the project a relative ref belongs to, seeded by a neighbouring folder", async () => {
    const root = await findAssetRoot(["docs/hero-flyin.gif"], [join(home, "somewhere-else")]);
    expect(root).toBe(join(home, "concorde"));
  });

  it("prefers the folder that holds the most of the refs", async () => {
    // `downloads/old` has hero-flyin.gif too; only concorde has both, so only it can be right.
    const root = await findAssetRoot(
      ["docs/hero-flyin.gif", "docs/cabin.png"],
      [join(home, "downloads")],
    );
    expect(root).toBe(join(home, "concorde"));
  });

  it("matches the whole relative path, not just the filename", async () => {
    // The same basename under a folder that isn't `docs/` is a different file.
    expect(await findAssetRoot(["shots/hero-flyin.gif"], [join(home, "concorde")])).toBeNull();
  });

  it("returns nothing rather than a guess when the file is nowhere", async () => {
    expect(await findAssetRoot(["docs/not-here-at-all.gif"], [home])).toBeNull();
  });

  it("has nothing to search with when every ref is absolute or an unservable type", async () => {
    expect(await findAssetRoot(["/etc/passwd", "notes/thing.psd"], [home])).toBeNull();
  });
});

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAssets } from "@main/services/assets";

// Kept off the real Spotlight index so the folder under test is the only one in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));

let base: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "vault-refs-"));
  mkdirSync(join(base, "docs"), { recursive: true });
  writeFileSync(join(base, "docs", "hero-flyin.gif"), Buffer.alloc(2048));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("resolveAssets", () => {
  it("reports found files with their size, and missing ones as missing", async () => {
    const { baseDir, detected, refs } = await resolveAssets(base, [
      "docs/hero-flyin.gif",
      "docs/nope.png",
    ]);
    expect(baseDir).toBe(base);
    expect(detected).toBe(false);
    expect(refs[0]).toEqual({
      ref: "docs/hero-flyin.gif",
      name: "hero-flyin.gif",
      status: "found",
      bytes: 2048,
    });
    expect(refs[1].status).toBe("missing");
  });

  it("looks for the folder itself when it is given none, and finds the file there", async () => {
    // The capture sheet gets plain text with no path attached; the ref's own folder
    // (`docs/hero-flyin.gif`, not just the filename) is what identifies the project.
    const { baseDir, detected, refs } = await resolveAssets(
      null,
      ["docs/hero-flyin.gif"],
      [join(base, "docs")],
    );
    expect(baseDir).toBe(base);
    expect(detected).toBe(true);
    expect(refs[0].status).toBe("found");
    expect(refs[0].bytes).toBe(2048);
  });

  it("says `unknown`, not `missing`, when the search comes up empty", async () => {
    // Nothing was found anywhere, so the UI must not accuse the file of being absent
    // from a folder the user never named.
    const { baseDir, detected, refs } = await resolveAssets(null, ["docs/no-such-file-xyz.gif"]);
    expect(baseDir).toBeNull();
    expect(detected).toBe(false);
    expect(refs[0].status).toBe("unknown");
    expect(refs[0].bytes).toBe(0);
  });

  it("flags types it cannot serve, whether or not a folder is known", async () => {
    expect((await resolveAssets(base, ["notes/thing.psd"])).refs[0].status).toBe("unsupported");
    expect((await resolveAssets(null, ["notes/thing.psd"])).refs[0].status).toBe("unsupported");
  });
});

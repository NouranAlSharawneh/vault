import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAssets } from "@main/services/assets";

let base: string;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "vault-refs-"));
  mkdirSync(join(base, "docs"), { recursive: true });
  writeFileSync(join(base, "docs", "hero-flyin.gif"), Buffer.alloc(2048));
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("resolveAssets", () => {
  it("reports found files with their size, and missing ones as missing", async () => {
    const [found, missing] = await resolveAssets(base, ["docs/hero-flyin.gif", "docs/nope.png"]);
    expect(found).toEqual({
      ref: "docs/hero-flyin.gif",
      name: "hero-flyin.gif",
      status: "found",
      bytes: 2048,
    });
    expect(missing.status).toBe("missing");
  });

  it("says `unknown`, not `missing`, when no folder has been chosen yet", async () => {
    // Nothing has been looked for, so the UI must not accuse the file of being absent.
    const [ref] = await resolveAssets(null, ["docs/hero-flyin.gif"]);
    expect(ref.status).toBe("unknown");
    expect(ref.bytes).toBe(0);
  });

  it("flags types it cannot serve, whether or not a folder is known", async () => {
    expect((await resolveAssets(base, ["notes/thing.psd"]))[0].status).toBe("unsupported");
    expect((await resolveAssets(null, ["notes/thing.psd"]))[0].status).toBe("unsupported");
  });
});

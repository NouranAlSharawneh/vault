import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { resolveAssets } from "@main/services/assets";

let home: string;
beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "vault-outside-"));
  mkdirSync(join(home, "project", "docs"), { recursive: true });
  writeFileSync(join(home, "project", "docs", "hero.png"), "png");
  writeFileSync(join(home, "secret.pdf"), "pdf");
});
afterAll(() => rmSync(home, { recursive: true, force: true }));

describe("refs checked against a folder", () => {
  it("never reach outside it, whatever they say", async () => {
    // `../secret.pdf` in a pasted README would have been copied into the vault and pushed.
    const r = await resolveAssets(join(home, "project"), ["../secret.pdf", "docs/hero.png"]);
    expect(r.refs.map((x) => x.status)).toEqual(["outside", "found"]);
  });

  it("read a repo-root path as relative to the folder, the way GitHub does", async () => {
    const r = await resolveAssets(join(home, "project"), ["/docs/hero.png"]);
    expect(r.refs[0].status).toBe("found");
  });
});

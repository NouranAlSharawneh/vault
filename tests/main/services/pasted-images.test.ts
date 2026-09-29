import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: a pasted image must never be looked for there anyway.
const spotlight = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@main/services/assets/spotlight", () => ({
  spotlightRoots: async () => {
    spotlight.calls++;

    return [];
  },
}));
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { resolveAssetRequest } from "@main/app/protocol/resolve-asset-request";
import {
  pruneStaged,
  resolveAssets,
  setStagingDir,
  stagedImagePath,
  stageImage,
} from "@main/services/assets";
import { insideVault } from "@main/services/fs/paths";
import { GitService } from "@main/services/git/git.service";
import { VaultService } from "@main/services/vault/vault.service";
import { ASSET_MAX_BYTES } from "@shared/constants";
import type { VaultConfig } from "@shared/types";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let staging: string;
let root: string;
let cache: string;
let vault: VaultService | null = null;

beforeEach(() => {
  staging = mkdtempSync(join(tmpdir(), "pasted-"));
  root = mkdtempSync(join(tmpdir(), "pasted-vault-"));
  cache = mkdtempSync(join(tmpdir(), "pasted-cache-"));
  setStagingDir(staging);
  spotlight.calls = 0;
});

afterEach(async () => {
  await vault?.close();
  vault = null;
  setStagingDir(null);
  for (const dir of [staging, root, cache]) rmSync(dir, { recursive: true, force: true });
});

describe("an image pasted into the editor", () => {
  it("waits in app data under a name only a paste gets", async () => {
    const ref = await stageImage("Screenshot.PNG", PNG);
    expect(ref).toMatch(/^paste-[0-9a-f]{12}\.png$/);
    expect(stagedImagePath(ref)).toBe(join(staging, ref));
    // An ordinary file of the same shape elsewhere is never taken for one.
    expect(stagedImagePath("screenshot.png")).toBeNull();
  });

  it("is refused when it isn't an image a reader shows, or is over GitHub's limit", async () => {
    await expect(stageImage("notes.pdf", PNG)).rejects.toThrow(/PNG, JPEG, GIF and WebP/);
    const huge = { byteLength: ASSET_MAX_BYTES + 1 } as Uint8Array;
    await expect(stageImage("huge.png", huge)).rejects.toThrow(/100 MB/);
  });

  it("is found by its name with no folder to look in, and never sent to Spotlight", async () => {
    const ref = await stageImage("image.png", PNG);
    const r = await resolveAssets(null, [ref]);
    expect(r.refs).toEqual([{ ref, name: ref, status: "found", bytes: PNG.byteLength }]);
    expect(spotlight.calls).toBe(0);
  });

  it("previews from where it waits until the save puts it next to the document", async () => {
    const ref = await stageImage("image.png", PNG);
    mkdirSync(join(root, "atlas-api"));
    const where = resolveAssetRequest(
      root,
      new URL(`marasca://asset/atlas-api/${ref}`),
      existsSync,
      insideVault,
      stagedImagePath,
    );
    expect(where).toEqual({ path: join(staging, ref), mime: "image/png" });
  });

  it("is cleared out once nobody has saved it for a month", async () => {
    const old = await stageImage("old.png", PNG);
    const fresh = await stageImage("fresh.png", PNG);
    const monthAgo = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000;
    utimesSync(join(staging, old), monthAgo, monthAgo);
    await pruneStaged();
    expect(stagedImagePath(old)).toBeNull();
    expect(stagedImagePath(fresh)).not.toBeNull();
  });
});

describe("saving a document with a pasted image", () => {
  const config = (): VaultConfig => ({
    root,
    remote: null,
    branch: "main",
    lastProject: null,
    lastSource: "manual",
    hotkey: "Control+Alt+V",
    pushDebounceMs: 3000,
  });

  it("copies it into the document's assets, commits it, and hands back the rewritten text", async () => {
    writeFileSync(join(root, "README.md"), "# vault\n");
    await GitService.init(root, "main");
    const g = new GitService(root, () => null);
    await g.ensureIdentity("Test", "test@example.com");
    await g.commitAll("seed");
    vault = new VaultService(config(), cache, () => null);
    await vault.open();

    const ref = await stageImage("image.png", PNG);
    const body = `# Launch\n\n![image](${ref})\n`;
    const res = await vault.save({
      body,
      frontmatter: { title: "Launch", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
      // A new document has no folder of its own yet: the paste goes with no base.
      assets: { baseDir: "", refs: [ref] },
    });

    expect(res.body).toBe(`# Launch\n\n![image](assets/${ref})\n`);
    expect(existsSync(join(root, "atlas-api", "assets", ref))).toBe(true);
    const tracked = await simpleGit({ baseDir: root }).raw(["ls-files"]);
    expect(tracked).toContain(`atlas-api/assets/${ref}`);
  });
});

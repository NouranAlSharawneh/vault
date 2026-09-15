import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: the temp workspaces below are the only folders in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { VaultService } from "@main/services/vault/vault.service";
import { GitService } from "@main/services/git/git.service";
import type { VaultConfig } from "@shared/types";

const doc = (title: string, body: string): string =>
  `# ${title}\n\n${body}\n\n---\n\n\`\`\`yaml\ntitle: ${title}\nproject: Atlas API\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n\`\`\`\n`;

const config = (root: string): VaultConfig => ({
  root,
  // `ensureRemote` leaves a clone's own origin alone, so nothing here reaches github.com.
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 50,
});

let origin: string;
let mine: string;
const temps: string[] = [];

const ahead = async (root: string): Promise<number> =>
  Number((await simpleGit({ baseDir: root }).raw(["rev-list", "--count", "origin/main..main"])).trim());

const openVault = async (root: string): Promise<VaultService> => {
  const cache = mkdtempSync(join(tmpdir(), "sync-cache-"));
  temps.push(cache);
  const v = new VaultService(config(root), cache, () => null);
  await v.open();
  return v;
};

beforeEach(async () => {
  origin = mkdtempSync(join(tmpdir(), "sync-origin-"));
  await simpleGit().init([origin, "--bare", "-b", "main"]);
  const seed = mkdtempSync(join(tmpdir(), "sync-seed-"));
  await GitService.init(seed, "main");
  const g = new GitService(seed, () => null);
  await g.ensureIdentity("Seed", "seed@test");
  mkdirSync(join(seed, "atlas-api"), { recursive: true });
  writeFileSync(join(seed, "atlas-api", "spec.md"), doc("Spec", "Original."));
  await g.commitAll("seed");
  await simpleGit({ baseDir: seed }).addRemote("origin", origin);
  await simpleGit({ baseDir: seed }).push("origin", "main");
  rmSync(seed, { recursive: true, force: true });

  mine = mkdtempSync(join(tmpdir(), "sync-mine-"));
  rmSync(mine, { recursive: true, force: true });
  await simpleGit().clone(origin, mine);
  await simpleGit({ baseDir: mine }).addConfig("user.name", "Test");
  await simpleGit({ baseDir: mine }).addConfig("user.email", "test@example.com");
  temps.push(origin, mine);
});

afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("an edit made outside Vault", () => {
  it("is committed before this window's version lands on top of it", async () => {
    const v = await openVault(mine);
    const first = await v.save({
      body: "Written here.",
      frontmatter: { title: "Shared", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });
    const loaded = await v.read(first.path);

    // Another editor writes the same file while it is open here.
    await new Promise((r) => setTimeout(r, 1200));
    writeFileSync(join(mine, first.path), doc("Shared", "WRITTEN SOMEWHERE ELSE"));

    const res = await v.save({
      body: "Written here, and then some more.",
      frontmatter: { title: "Shared", project: "Atlas API", tags: [], source: "manual" },
      existingPath: first.path,
      baseMtime: loaded.meta.mtime,
      commit: true,
    });

    // This window's text wins the file — the user is mid-thought and must not lose it —
    // but the other version is one commit back rather than gone.
    expect(res.preservedExternalEdit).toBe(true);
    expect(readFileSync(join(mine, first.path), "utf8")).toContain("and then some more");
    const history = await v.history(first.path);
    expect(history[1].message).toBe("external: Shared");
    expect(await v.atCommit(first.path, history[1].sha)).toContain("WRITTEN SOMEWHERE ELSE");
    await v.close();
  }, 60_000);

  it("is not claimed when nothing else touched the file", async () => {
    const v = await openVault(mine);
    const first = await v.save({
      body: "Only ever written here.",
      frontmatter: { title: "Alone", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });
    const loaded = await v.read(first.path);
    const res = await v.save({
      body: "Only ever written here, twice.",
      frontmatter: { title: "Alone", project: "Atlas API", tags: [], source: "manual" },
      existingPath: first.path,
      baseMtime: loaded.meta.mtime,
      commit: true,
    });
    expect(res.preservedExternalEdit).toBeFalsy();
    expect((await v.history(first.path)).some((c) => c.message.startsWith("external:"))).toBe(false);
    await v.close();
  }, 60_000);
});

describe("sync", () => {
  it("pushes work that was committed but never sent, next time the vault opens", async () => {
    const first = await openVault(mine);
    await first.save({
      body: "Written just before quitting.",
      frontmatter: { title: "Later", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });
    // Quit inside the push debounce, the way closing the window does.
    await first.close();
    expect(await ahead(mine)).toBe(1);

    const second = await openVault(mine);
    await vi.waitFor(async () => expect(await ahead(mine)).toBe(0), { timeout: 15_000 });
    expect(second.status().state).toBe("synced");
    await second.close();
  }, 60_000);

  it("does not push on open when there is nothing waiting", async () => {
    const v = await openVault(mine);
    const pushNow = vi.spyOn(v, "pushNow");
    await new Promise((r) => setTimeout(r, 600));
    expect(pushNow).not.toHaveBeenCalled();
    await v.close();
  }, 60_000);
});

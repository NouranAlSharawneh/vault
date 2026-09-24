import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: the temp workspaces below are the only folders in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { GitService } from "@main/services/git/git.service";
import { VaultService } from "@main/services/vault/vault.service";
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
  Number(
    (await simpleGit({ baseDir: root }).raw(["rev-list", "--count", "origin/main..main"])).trim(),
  );

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

describe("an edit made outside Marasca", () => {
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
    expect((await v.history(first.path)).some((c) => c.message.startsWith("external:"))).toBe(
      false,
    );
    await v.close();
  }, 60_000);
});

describe("a push and a pull at the same time", () => {
  it("do not finish each other's rebase", async () => {
    // Someone else has already pushed a change to the same document.
    const other = mkdtempSync(join(tmpdir(), "sync-other-"));
    rmSync(other, { recursive: true, force: true });
    await simpleGit().clone(origin, other);
    await simpleGit({ baseDir: other }).addConfig("user.name", "Other");
    await simpleGit({ baseDir: other }).addConfig("user.email", "other@example.com");
    temps.push(other);
    writeFileSync(join(other, "atlas-api", "spec.md"), doc("Spec", "Written elsewhere."));
    await simpleGit({ baseDir: other }).add(["-A"]);
    await simpleGit({ baseDir: other }).commit("theirs");
    await simpleGit({ baseDir: other }).push("origin", "main");

    writeFileSync(join(mine, "atlas-api", "spec.md"), doc("Spec", "Written here."));
    await simpleGit({ baseDir: mine }).add(["-A"]);
    await simpleGit({ baseDir: mine }).commit("mine");

    // open() starts a pull; saving within the next second starts a push. Before they
    // were queued, this raced and the badge went red with "fatal: No rebase in progress?".
    const v = await openVault(mine);
    const status = await v.pushNow();

    expect(status.lastError).toBeNull();
    expect(status.state).toBe("synced");
    expect(v.git.rebaseInProgress()).toBe(false);
    const onRemote = await simpleGit({ baseDir: origin }).raw(["log", "--oneline", "main"]);
    expect(onRemote).toContain("mine");
    // Both versions were kept, exactly as a pull would have done on its own.
    expect(status.conflicts).toBe(1);
    await v.close();
  }, 90_000);
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

describe("a pull asked for by hand", () => {
  it("says how much came down, and nothing the second time", async () => {
    const other = mkdtempSync(join(tmpdir(), "sync-other-"));
    rmSync(other, { recursive: true, force: true });
    await simpleGit().clone(origin, other);
    await simpleGit({ baseDir: other }).addConfig("user.name", "Other");
    await simpleGit({ baseDir: other }).addConfig("user.email", "other@example.com");
    temps.push(other);
    for (const name of ["one", "two"]) {
      writeFileSync(join(other, "atlas-api", `${name}.md`), doc(name, "From elsewhere."));
      await simpleGit({ baseDir: other }).add(["-A"]);
      await simpleGit({ baseDir: other }).commit(name);
    }
    await simpleGit({ baseDir: other }).push("origin", "main");

    // Opening starts a pull of its own; asking now joins it rather than finding nothing.
    const v = await openVault(mine);
    expect(await v.pull()).toMatchObject({ pulled: 2, failure: null, conflicts: [] });
    expect(await v.pull()).toMatchObject({ pulled: 0, failure: null });
    await v.close();
  }, 60_000);
});

describe("a vault with no GitHub repo", () => {
  it("never reports its commits as waiting to be pushed", async () => {
    // With no upstream, every commit used to count as "ahead", so a local-only vault
    // offered to "Push 12 pending docs" to a remote it does not have.
    const root = mkdtempSync(join(tmpdir(), "sync-local-"));
    const cache = mkdtempSync(join(tmpdir(), "sync-cache-"));
    temps.push(root, cache);
    const v = new VaultService({ ...config(root), remote: null }, cache, () => null);
    await v.open();
    await v.save({
      body: "Only ever here.",
      frontmatter: { title: "Local", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });

    expect((await v.refreshSyncStatus()).ahead).toBe(0);
    await v.close();
  }, 60_000);
});

describe("paths from the renderer", () => {
  it("cannot reach outside the vault", async () => {
    const outside = mkdtempSync(join(tmpdir(), "sync-outside-"));
    temps.push(outside);
    writeFileSync(join(outside, "secret.md"), "NOT IN THE VAULT");
    const v = await openVault(mine);

    // `../x.md` was already refused by accident — the indexer rejects a leading dot —
    // but a path that descends first used to sail through, and `read` returned the file,
    // indexed it, and wrote its path into the README that gets pushed to GitHub.
    const escape = `atlas-api/${"../".repeat(12)}${outside.slice(1)}/secret.md`;
    await expect(v.read(escape)).rejects.toThrow(/Outside the vault/);
    await expect(v.trash(escape)).rejects.toThrow(/Outside the vault/);
    await expect(v.history(escape)).rejects.toThrow(/Outside the vault/);
    await expect(
      v.save({
        body: "x",
        frontmatter: { title: "x", project: "P", tags: [], source: "manual" },
        existingPath: escape,
        commit: false,
      }),
    ).rejects.toThrow(/Outside the vault/);

    // And an ordinary path still works.
    expect((await v.read("atlas-api/spec.md")).body).toContain("Original.");
    await v.close();
  }, 60_000);
});

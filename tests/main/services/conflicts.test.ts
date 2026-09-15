import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: the temp workspaces below are the only folders in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { GitService } from "@main/services/git/git.service";
import { VaultService } from "@main/services/vault/vault.service";
import type { VaultConfig } from "@shared/types";

const DOC = "atlas-api/rate-limiting.md";

/** A document the app would recognise: body first, metadata fenced at the end. */
const doc = (title: string, body: string): string =>
  `# ${title}\n\n${body}\n\n---\n\n\`\`\`yaml\ntitle: ${title}\nproject: Atlas API\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n\`\`\`\n`;

let origin: string;
let mine: string;
let other: string;
let cache: string;
let vault: VaultService;

const config = (root: string): VaultConfig => ({
  root,
  // Set so pull/push run at all. `ensureRemote` leaves the clone's own origin alone,
  // so nothing here ever reaches github.com.
  remote: "nunu/vault",
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 50,
});

/** Commit in a working copy the way another machine would, and push it up. */
async function commitAndPush(root: string, path: string, text: string, message: string) {
  writeFileSync(join(root, path), text);
  const g = simpleGit({ baseDir: root });
  await g.add(["-A"]);
  await g.commit(message);
  await g.push("origin", "main");
}

/** Both machines change the same document; the other one gets there first. */
async function raceOnTheSameDoc(mineText: string, theirText: string) {
  await commitAndPush(other, DOC, theirText, "their edit");
  writeFileSync(join(mine, DOC), mineText);
  const g = simpleGit({ baseDir: mine });
  await g.add(["-A"]);
  await g.commit("my edit");
  await vault.open();
}

beforeEach(async () => {
  origin = mkdtempSync(join(tmpdir(), "vault-origin-"));
  cache = mkdtempSync(join(tmpdir(), "vault-cache-"));
  await simpleGit().init([origin, "--bare", "-b", "main"]);

  const seed = mkdtempSync(join(tmpdir(), "vault-seed-"));
  await GitService.init(seed, "main");
  const g = new GitService(seed, () => null);
  await g.ensureIdentity("Seed", "seed@test");
  await simpleGit({ baseDir: seed })
    .raw(["mkdir-does-not-exist"])
    .catch(() => undefined);
  const { mkdirSync } = await import("node:fs");
  mkdirSync(join(seed, "atlas-api"), { recursive: true });
  writeFileSync(join(seed, DOC), doc("Rate limiting", "The original line."));
  await g.commitAll("seed");
  await simpleGit({ baseDir: seed }).addRemote("origin", origin);
  await simpleGit({ baseDir: seed }).push("origin", "main");
  rmSync(seed, { recursive: true, force: true });

  mine = mkdtempSync(join(tmpdir(), "vault-mine-"));
  other = mkdtempSync(join(tmpdir(), "vault-other-"));
  rmSync(mine, { recursive: true, force: true });
  rmSync(other, { recursive: true, force: true });
  await simpleGit().clone(origin, mine);
  await simpleGit().clone(origin, other);
  for (const root of [mine, other]) {
    const gg = simpleGit({ baseDir: root });
    await gg.addConfig("user.name", "Test");
    await gg.addConfig("user.email", "test@example.com");
  }
  vault = new VaultService(config(mine), cache, () => null);
});

afterEach(async () => {
  await vault.close();
  for (const d of [origin, mine, other, cache]) rmSync(d, { recursive: true, force: true });
});

describe("sync conflicts", () => {
  it("keeps both versions, mine where it was and theirs beside it", async () => {
    await raceOnTheSameDoc(
      doc("Rate limiting", "Written on this machine."),
      doc("Rate limiting", "Written somewhere else."),
    );
    const { conflicts } = await vault.pull();

    // The side that matters. A rebase replays your commits on top of the remote's, so
    // git's "ours" is the remote — reading it the other way round is what used to hand
    // you the wrong version, silently.
    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Written on this machine.");
    const copy = DOC.replace(".md", "-from-github.md");
    expect(readFileSync(join(mine, copy), "utf8")).toContain("Written somewhere else.");

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].mine.path).toBe(DOC);
    expect(conflicts[0].theirs.path).toBe(copy);
    expect(conflicts[0].mark.of).toBe(DOC);
    // Counted, not made into a push state: you can be perfectly well pushed and still
    // owe a pair an answer, and as a state it vanished the moment you typed anything.
    expect(vault.status().conflicts).toBe(1);

    // And the vault is left in a state the rest of the app can work in: no rebase
    // half-finished, nothing unstaged, both versions committed.
    expect(vault.git.rebaseInProgress()).toBe(false);
    expect((await vault.git.git.status()).conflicted).toEqual([]);
  });

  it("finds the pair again from the documents alone, with no state on the side", async () => {
    await raceOnTheSameDoc(doc("Rate limiting", "Mine."), doc("Rate limiting", "Theirs."));
    await vault.pull();
    // As if the app had been restarted: the first service is stopped first, so its
    // watcher and its quiet pull loop are not still working the same folder while the
    // second one indexes it.
    await vault.close();
    const fresh = new VaultService(config(mine), cache, () => null);
    await fresh.open();
    const pairs = await fresh.conflicts();
    expect(pairs.map((p) => [p.mine.path, p.theirs.path])).toEqual([
      [DOC, DOC.replace(".md", "-from-github.md")],
    ]);
    await fresh.close();
  });

  it("keeping mine sends the other version to the trash rather than deleting it", async () => {
    await raceOnTheSameDoc(doc("Rate limiting", "Mine."), doc("Rate limiting", "Theirs."));
    await vault.pull();
    const copy = DOC.replace(".md", "-from-github.md");
    await vault.resolveConflict(copy, "mine");

    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Mine.");
    expect(existsSync(join(mine, copy))).toBe(false);
    const trashed = await vault.listTrash();
    expect(trashed.map((t) => t.originalPath)).toContain(copy);
    expect(await vault.conflicts()).toHaveLength(0);
  });

  it("keeping theirs moves it onto the original path and trashes what was there", async () => {
    await raceOnTheSameDoc(doc("Rate limiting", "Mine."), doc("Rate limiting", "Theirs."));
    await vault.pull();
    const copy = DOC.replace(".md", "-from-github.md");
    await vault.resolveConflict(copy, "theirs");

    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Theirs.");
    expect(readFileSync(join(mine, DOC), "utf8")).not.toContain("conflict:");
    expect(existsSync(join(mine, copy))).toBe(false);
    expect((await vault.listTrash()).map((t) => t.originalPath)).toContain(DOC);
    expect(await vault.conflicts()).toHaveLength(0);
  });

  it("keeping both just stops asking", async () => {
    await raceOnTheSameDoc(doc("Rate limiting", "Mine."), doc("Rate limiting", "Theirs."));
    await vault.pull();
    const copy = DOC.replace(".md", "-from-github.md");
    await vault.resolveConflict(copy, "both");

    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Mine.");
    // The stamp is what told the pair apart; without it they would share a title, so
    // the surviving copy carries the difference in its own name.
    const kept = readFileSync(join(mine, copy), "utf8");
    expect(kept).toContain("Theirs.");
    expect(kept).toContain("title: Rate limiting (from GitHub)");
    expect(kept).not.toContain("conflict:");
    expect(await vault.conflicts()).toHaveLength(0);
    expect(await vault.listTrash()).toHaveLength(0);
  });

  it("keeps the surviving text when one side deleted the document", async () => {
    const g = simpleGit({ baseDir: other });
    await g.rm([DOC]);
    await g.commit("their delete");
    await g.push("origin", "main");
    writeFileSync(join(mine, DOC), doc("Rate limiting", "Still wanted."));
    const mg = simpleGit({ baseDir: mine });
    await mg.add(["-A"]);
    await mg.commit("my edit");
    await vault.open();

    const { conflicts } = await vault.pull();
    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Still wanted.");
    // Nothing to choose between, so nothing is asked.
    expect(conflicts).toHaveLength(0);
    expect(vault.git.rebaseInProgress()).toBe(false);
  });

  it("finishes a rebase that stops on more than one of my commits", async () => {
    await commitAndPush(other, DOC, doc("Rate limiting", "Theirs."), "their edit");
    const mg = simpleGit({ baseDir: mine });
    for (const line of ["First of mine.", "Second of mine."]) {
      writeFileSync(join(mine, DOC), doc("Rate limiting", line));
      await mg.add(["-A"]);
      await mg.commit(line);
    }
    await vault.open();
    await vault.pull();

    expect(vault.git.rebaseInProgress()).toBe(false);
    expect((await vault.git.git.status()).conflicted).toEqual([]);
    expect(readFileSync(join(mine, DOC), "utf8")).toContain("Second of mine.");
  });

  it("leaves no rebase behind when the fetch itself fails", async () => {
    await raceOnTheSameDoc(doc("Rate limiting", "Mine."), doc("Rate limiting", "Theirs."));
    rmSync(origin, { recursive: true, force: true });
    const { conflicts } = await vault.pull();
    expect(conflicts).toHaveLength(0);
    expect(vault.git.rebaseInProgress()).toBe(false);
    expect(["error", "offline"]).toContain(vault.status().state);
  });
});

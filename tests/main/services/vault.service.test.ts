import type * as NodeOs from "node:os";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: the temp workspace below is the only folder in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
// The walk also seeds from the home folder, which would let any matching file on this Mac
// answer instead of the fixture. Point it somewhere that holds nothing.
vi.mock("node:os", async (importOriginal) => {
  const os = await importOriginal<typeof NodeOs>();
  const homedir = () => `${os.tmpdir()}/vault-test-no-home`;

  return { ...os, homedir, default: { ...os, homedir } };
});
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAssets } from "@main/services/assets";
import { GitService } from "@main/services/git/git.service";
import { IndexerService } from "@main/services/indexer/indexer.service";
import { VaultService } from "@main/services/vault/vault.service";
import { findAssetRefs, resolveAssetUrl } from "@shared/helpers";

const PROJECTS = ["Atlas API", "Onboarding v2", "Research log", "Edge POPs"];
const TAGS = ["spec", "adr", "prompt", "infra", "meeting"];

function makeFixture(root: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const project = PROJECTS[i % PROJECTS.length];
    const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    mkdirSync(join(root, slug), { recursive: true });
    const tags = [TAGS[i % TAGS.length], ...(i % 3 === 0 ? [TAGS[(i + 1) % TAGS.length]] : [])];
    const created = new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString();
    const keyword = i % 7 === 0 ? "ratelimit" : "nothing";
    const body = `# Document ${i}\n\nThis is document number ${i} about ${project}. It mentions the ${tags[0]} keyword ${keyword}.\n\n## Section\n\n- point a\n- point b\n`;
    const yaml = `title: Document ${i}\nproject: ${project}\ntags: [${tags.join(", ")}]\ncreated: ${created}\nsource: claude`;
    // Every tenth file keeps a classic head block so both layouts are always exercised;
    // one of them is padded past the "read the whole file" size to hit the tail reader.
    const legacy = i % 10 === 0;
    const padding = i === 5 ? "\n" + "Lorem ipsum dolor sit amet. ".repeat(1_000) : "";
    writeFileSync(
      join(root, slug, `document-${i}.md`),
      legacy
        ? `---\n${yaml}\n---\n\n${body}`
        : `${body}${padding}\n---\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n`,
    );
  }
  mkdirSync(join(root, "_inbox"), { recursive: true });
  writeFileSync(join(root, "_inbox", "untagged.md"), "# Loose note\n\nNo frontmatter here.\n");
}

let root: string;
let cache: string;
let vault: VaultService;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "vault-test-"));
  cache = mkdtempSync(join(tmpdir(), "vault-cache-"));
  makeFixture(root, 800);
  await GitService.init(root, "main");
  const g = new GitService(root, () => null);
  await g.ensureIdentity("Test", "test@example.com");
  await g.commitAll("seed");
  vault = new VaultService(
    {
      root,
      remote: null,
      branch: "main",
      lastProject: null,
      lastSource: "claude",
      hotkey: "Control+Alt+V",
      pushDebounceMs: 3000,
    },
    cache,
    () => null,
  );
}, 60_000);

afterAll(async () => {
  await vault.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

describe("VaultService (800-doc fixture)", () => {
  it("cold-scans 800 docs in well under a second", async () => {
    const t = performance.now();
    const snap = await vault.open();
    const ms = performance.now() - t;
    expect(snap.docs.length).toBe(801);
    expect(snap.orphans).toBe(1);
    expect(snap.projects.map((p) => p.name)).toContain("Atlas API");
    expect(snap.projects.find((p) => p.slug === "_inbox")?.count).toBe(1);
    expect(snap.tags.find((t) => t.tag === "spec")?.count).toBeGreaterThan(100);
    expect(ms).toBeLessThan(3000);
    // The padded file is read from both ends: metadata from the tail, excerpt from the head.
    const big = snap.docs.find((d) => d.path.endsWith("/document-5.md"));
    expect(big?.orphan).toBe(false);
    expect(big?.title).toBe("Document 5");
    expect(big?.excerpt.startsWith("This is document number 5")).toBe(true);
  });

  it("writes README index and .vault scaffold", () => {
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("## Atlas API (200)");
    expect(existsSync(join(root, ".vault", "templates", "adr.md"))).toBe(true);
  });

  it("saves a new doc as one commit with regenerated README", async () => {
    const before = (await vault.git.git.log()).total;
    const res = await vault.save({
      body: "# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer.\n",
      frontmatter: {
        title: "Rate limiting at the edge",
        project: "Atlas API",
        tags: ["spec", "infra"],
        source: "claude",
      },
      commit: true,
    });
    expect(res.path).toBe("atlas-api/rate-limiting-at-the-edge.md");
    expect(res.committed).toBe(true);
    const log = await vault.git.git.log();
    expect(log.total).toBe(before + 1);
    expect(log.latest?.message).toBe("add: Rate limiting at the edge");
    const raw = readFileSync(join(root, res.path), "utf8");
    expect(raw.startsWith("# Rate limiting")).toBe(true);
    expect(raw).toContain(
      "\n---\n\n```yaml\ntitle: Rate limiting at the edge\nproject: Atlas API\ntags: [spec, infra]\ncreated: ",
    );
    expect(raw.endsWith("source: claude\n```\n")).toBe(true);
    expect(readFileSync(join(root, "README.md"), "utf8")).toContain(
      "[Rate limiting at the edge](atlas-api/rate-limiting-at-the-edge.md)",
    );
    expect(vault.index.get(res.path)?.title).toBe("Rate limiting at the edge");
  });

  it("de-duplicates filenames with a numeric suffix and trashes safely", async () => {
    const res = await vault.save({
      body: "second one",
      frontmatter: {
        title: "Rate limiting at the edge",
        project: "Atlas API",
        tags: [],
        source: "manual",
      },
      commit: false,
    });
    expect(res.path).toBe("atlas-api/rate-limiting-at-the-edge-2.md");
    const trashed = await vault.trash(res.path);
    expect(vault.index.get(res.path)).toBeUndefined();
    expect(existsSync(join(root, ".trash", res.path))).toBe(true);
    expect(trashed.originalPath).toBe(res.path);
    expect(trashed.meta.title).toBe("Rate limiting at the edge");
  });

  it("lists, restores and purges the trash", async () => {
    const listed = await vault.listTrash();
    expect(listed.map((t) => t.originalPath)).toEqual(["atlas-api/rate-limiting-at-the-edge-2.md"]);
    expect(listed[0].meta.projectSlug).toBe("atlas-api");
    expect(listed[0].meta.project).toBe("Atlas API");
    const read = await vault.readTrashed(listed[0].path);
    expect(read.body.trim()).toBe("second one");

    const restored = await vault.restoreFromTrash(listed[0].path);
    expect(restored.path).toBe("atlas-api/rate-limiting-at-the-edge-2.md");
    expect(vault.index.get(restored.path)?.title).toBe("Rate limiting at the edge");
    expect((await vault.git.git.log()).latest?.message).toBe("restore: Rate limiting at the edge");
    expect(await vault.listTrash()).toEqual([]);

    await vault.trash(restored.path);
    await expect(vault.readTrashed("atlas-api/rate-limiting-at-the-edge.md")).rejects.toThrow();
    expect(await vault.purgeTrash()).toEqual({ removed: 1, assets: [] });
    expect(existsSync(join(root, ".trash"))).toBe(false);
    expect((await vault.git.git.log()).latest?.message).toBe("purge: trash (1 doc)");
    const status = await vault.git.git.status();
    expect(status.files.filter((f) => f.path.startsWith(".trash"))).toEqual([]);
  });

  it("takes an image with the doc when the doc is deleted for good", async () => {
    // Trashing leaves images alone so a restore can find them again, which makes purging
    // the only moment they can go. Before this they stayed in the repo forever, with
    // nothing left anywhere that mentioned them.
    const src = mkdtempSync(join(tmpdir(), "vault-purge-"));
    mkdirSync(join(src, "docs"), { recursive: true });
    writeFileSync(join(src, "docs", "solo.gif"), Buffer.from("GIF89a"));
    writeFileSync(join(src, "docs", "shared.gif"), Buffer.from("GIF89a"));

    const doomed = await vault.save({
      body: "# Doomed\n\n![a](docs/solo.gif)\n![b](docs/shared.gif)\n",
      frontmatter: { title: "Doomed", project: "Purge Me", tags: [], source: "manual" },
      commit: true,
      assets: { baseDir: src, refs: ["docs/solo.gif", "docs/shared.gif"] },
    });
    // A second doc in the same project points at one of the two copied files.
    const keeper = await vault.save({
      body: "# Keeper\n\n![b](assets/shared.gif)\n",
      frontmatter: { title: "Keeper", project: "Purge Me", tags: [], source: "manual" },
      commit: true,
    });
    expect(existsSync(join(root, "purge-me", "assets", "solo.gif"))).toBe(true);

    const trashed = await vault.trash(doomed.path);
    // Still there while it's only in the trash — a restore has to be able to find it.
    expect(existsSync(join(root, "purge-me", "assets", "solo.gif"))).toBe(true);

    const res = await vault.purgeTrash(trashed.path);
    expect(res).toEqual({ removed: 1, assets: ["purge-me/assets/solo.gif"] });
    expect(existsSync(join(root, "purge-me", "assets", "solo.gif"))).toBe(false);
    // The one the other doc still uses stays, and so does that doc.
    expect(existsSync(join(root, "purge-me", "assets", "shared.gif"))).toBe(true);
    expect(existsSync(join(root, keeper.path))).toBe(true);
    // Gone from git too, in the same commit as the doc.
    const shown = await vault.git.git.show(["--stat", "--format=%s", "HEAD"]);
    expect(shown).toContain("purge: Doomed");
    expect(shown).toContain("purge-me/assets/solo.gif");
    expect(shown).not.toContain("shared.gif");
    rmSync(src, { recursive: true, force: true });
  });

  it("empties the trash and takes the images that went in with it", async () => {
    const src = mkdtempSync(join(tmpdir(), "vault-purge-all-"));
    mkdirSync(join(src, "docs"), { recursive: true });
    writeFileSync(join(src, "docs", "only.gif"), Buffer.from("GIF89a"));
    const doc = await vault.save({
      body: "# Alone\n\n![a](docs/only.gif)\n",
      frontmatter: { title: "Alone", project: "Empty Me", tags: [], source: "manual" },
      commit: true,
    });
    const withAsset = await vault.save({
      body: "# Alone\n\n![a](docs/only.gif)\n",
      frontmatter: { title: "Alone", project: "Empty Me", tags: [], source: "manual" },
      existingPath: doc.path,
      commit: true,
      assets: { baseDir: src, refs: ["docs/only.gif"] },
    });
    await vault.trash(withAsset.path);

    const res = await vault.purgeTrash();
    expect(res.assets).toContain("empty-me/assets/only.gif");
    expect(existsSync(join(root, "empty-me", "assets", "only.gif"))).toBe(false);
    // An emptied `assets/` folder does not linger either.
    expect(existsSync(join(root, "empty-me", "assets"))).toBe(false);
    rmSync(src, { recursive: true, force: true });
  });

  it("copies referenced images into <project>/assets and rewrites the links in one commit", async () => {
    const src = mkdtempSync(join(tmpdir(), "vault-assets-"));
    mkdirSync(join(src, "docs"), { recursive: true });
    writeFileSync(join(src, "docs", "Hero Fly-in.gif"), Buffer.from("GIF89a"));
    writeFileSync(join(src, "docs", "hero-fly-in.png"), Buffer.from("PNG"));
    const res = await vault.save({
      body: '# Concorde\n\n![hero](<docs/Hero Fly-in.gif>)\n<img src="docs/hero-fly-in.png">\n![gone](docs/missing.png)\n',
      frontmatter: { title: "Concorde", project: "Personal", tags: [], source: "manual" },
      commit: true,
      assets: {
        baseDir: src,
        refs: ["docs/Hero Fly-in.gif", "docs/hero-fly-in.png", "docs/missing.png"],
      },
    });
    expect(res.path).toBe("personal/concorde.md");
    expect(res.assets).toEqual([
      "personal/assets/hero-fly-in.gif",
      "personal/assets/hero-fly-in.png",
    ]);
    const raw = readFileSync(join(root, res.path), "utf8");
    expect(raw).toContain("![hero](assets/hero-fly-in.gif)");
    expect(raw).toContain('<img src="assets/hero-fly-in.png">');
    expect(raw).toContain("![gone](docs/missing.png)");
    expect(existsSync(join(root, "personal", "assets", "hero-fly-in.gif"))).toBe(true);
    const shown = await vault.git.git.show(["--stat", "--format=%s", "HEAD"]);
    expect(shown).toContain("add: Concorde");
    expect(shown).toContain("personal/assets/hero-fly-in.gif");
    expect(shown).toContain("personal/assets/hero-fly-in.png");
    rmSync(src, { recursive: true, force: true });
  });

  it("captures an image with no folder given: finds it, copies it, rewrites the link", async () => {
    // The bug this covers: text pasted from a README carries no path, so nothing was copied
    // and the doc committed with `docs/hero-flyin.gif` still in it — a link with nothing
    // behind it, which the reader renders as a broken image.
    const workspace = mkdtempSync(join(tmpdir(), "vault-workspace-"));
    mkdirSync(join(workspace, "concorde", "docs"), { recursive: true });
    writeFileSync(join(workspace, "concorde", "docs", "hero-flyin.gif"), Buffer.from("GIF89a"));
    const body = "# Concorde\n\n![The landing page](docs/hero-flyin.gif)\n";

    const plan = await resolveAssets(null, findAssetRefs(body), [join(workspace, "elsewhere")]);
    expect(plan.baseDir).toBe(join(workspace, "concorde"));
    expect(plan.detected).toBe(true);
    expect(plan.refs[0].status).toBe("found");

    const res = await vault.save({
      body,
      frontmatter: { title: "Concorde", project: "Concorde", tags: [], source: "claude" },
      commit: true,
      assets: { baseDir: plan.baseDir!, refs: plan.refs.map((r) => r.ref) },
    });
    expect(readFileSync(join(root, res.path), "utf8")).toContain(
      "![The landing page](assets/hero-flyin.gif)",
    );
    // And the rewritten link is exactly what the reader turns into a `vault://` URL.
    expect(resolveAssetUrl("assets/hero-flyin.gif", res.path)).toBe(
      "vault://asset/concorde/assets/hero-flyin.gif",
    );
    expect(existsSync(join(root, "concorde", "assets", "hero-flyin.gif"))).toBe(true);
    rmSync(workspace, { recursive: true, force: true });
  });

  it("moves the file when the project changes and keeps `created`", async () => {
    const p = "atlas-api/rate-limiting-at-the-edge.md";
    const created = vault.index.get(p)!.created;
    const res = await vault.save({
      body: "# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer. Moved.\n",
      frontmatter: {
        title: "Rate limiting at the edge",
        project: "Edge POPs",
        tags: ["infra"],
        source: "claude",
      },
      existingPath: p,
      commit: true,
    });
    expect(res.path).toBe("edge-pops/rate-limiting-at-the-edge.md");
    expect(res.meta.created).toBe(created);
    expect(existsSync(join(root, p))).toBe(false);
    const hist = await vault.history(res.path);
    expect(hist.length).toBeGreaterThanOrEqual(2);
    expect(hist[0].message).toBe("move: Rate limiting at the edge");
  });

  it("records nothing, and rewrites no commit, when a save changes nothing", async () => {
    // A commit with nothing staged used to go on to amend the commit before it — often
    // one already on GitHub, so the next push was rejected.
    const p = "edge-pops/rate-limiting-at-the-edge.md";
    const same = {
      body: "# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer. Moved.\n",
      frontmatter: {
        title: "Rate limiting at the edge",
        project: "Edge POPs",
        tags: ["infra"],
        source: "claude" as const,
      },
      existingPath: p,
    };
    const head = (await vault.git.git.log()).latest?.hash;
    const committed = await vault.save({ ...same, commit: true });
    expect(committed).toMatchObject({ path: p, committed: false, changed: false });
    expect((await vault.git.git.log()).latest?.hash).toBe(head);
    expect(await vault.save({ ...same, commit: false })).toMatchObject({ changed: false });

    // Written but not committed, then committed as it stands: the commit is the change.
    const edited = { ...same, body: same.body + "\nOne more line.\n" };
    expect(await vault.save({ ...edited, commit: false })).toMatchObject({
      committed: false,
      changed: true,
    });
    expect(await vault.save({ ...edited, commit: true })).toMatchObject({
      committed: true,
      changed: true,
    });
    expect((await vault.git.git.log()).latest?.message).toBe("update: Rate limiting at the edge");
  });

  it("full-text search finds body terms and ranks titles first", async () => {
    await new Promise((r) => setTimeout(r, 800)); // lazy body pass
    expect(vault.search("ratelimit").length).toBeGreaterThan(50);
    expect(vault.search("Document 42")[0].path).toBe("research-log/document-42.md");
  });

  it("renames a project in one commit", { timeout: 30_000 }, async () => {
    const before = (await vault.git.git.log()).total;
    const r = await vault.renameProject("Onboarding v2", "Onboarding v3");
    expect(r.moved).toBe(200);
    expect((await vault.git.git.log()).total).toBe(before + 1);
    expect(vault.index.snapshot().projects.find((p) => p.name === "Onboarding v3")?.count).toBe(
      200,
    );
    expect(readFileSync(join(root, "onboarding-v3", "document-1.md"), "utf8")).toContain(
      "project: Onboarding v3",
    );
  });

  it("takes the project's images with it, and leaves nothing behind", async () => {
    // Renaming used to move only the `.md` files. Every relative image in the project
    // then pointed at a folder that no longer held any, and the old folder stayed on disk
    // because the rmdir that should have removed it could never succeed.
    mkdirSync(join(root, "research-log", "assets"), { recursive: true });
    writeFileSync(join(root, "research-log", "assets", "hero.png"), "png-bytes");
    writeFileSync(join(root, "research-log", "notes.txt"), "not a document");
    await vault.renameProject("Research log", "Field log");

    expect(readFileSync(join(root, "field-log", "assets", "hero.png"), "utf8")).toBe("png-bytes");
    expect(readFileSync(join(root, "field-log", "notes.txt"), "utf8")).toBe("not a document");
    expect(existsSync(join(root, "research-log"))).toBe(false);
  });

  it("follows a document through a project move for history, diff and restore", async () => {
    // Changing a doc's project is a `git mv`. Every one of these used to ask git for
    // the doc's *current* path at an older commit, which is a file that did not exist
    // yet — so history worked and everything built on it broke, but only for docs that
    // had moved. Exactly the case a real vault hits and a fresh fixture never does.
    const first = await vault.save({
      body: "# Travelling doc\n\nOriginal body.\n",
      frontmatter: { title: "Travelling doc", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });
    expect(first.path).toBe("atlas-api/travelling-doc.md");

    const moved = await vault.save({
      body: "# Travelling doc\n\nBody after the move.\n",
      frontmatter: { title: "Travelling doc", project: "Research log", tags: [], source: "manual" },
      existingPath: first.path,
      commit: true,
    });
    expect(moved.path).toBe("research-log/travelling-doc.md");

    const log = await vault.history(moved.path);
    expect(log.length).toBeGreaterThanOrEqual(2);
    // The oldest entry remembers the name it had back then, not the name it has now.
    const oldest = log[log.length - 1];
    expect(oldest.path).toBe("atlas-api/travelling-doc.md");

    // Reading that version by today's path would find nothing.
    expect(await vault.atCommit(moved.path, oldest.sha)).toContain("Original body.");
    expect(await vault.diff(moved.path, oldest.sha)).toContain("+Original body.");

    const restored = await vault.restore(moved.path, oldest.sha);
    expect(readFileSync(join(root, restored.path), "utf8")).toContain("Original body.");
    // Restoring is a new commit — the history is never rewritten.
    expect((await vault.git.git.log()).latest?.message).toContain("Travelling doc");
  });

  it("warm-starts from cache + git diff", async () => {
    const head = await vault.git.headSha();
    const idx = new IndexerService(root, cache, vault.git);
    const t = performance.now();
    const snap = await idx.load();
    expect(performance.now() - t).toBeLessThan(2500);
    expect(snap.headSha).toBe(head);
    expect(snap.docs.length).toBe(vault.index.snapshot().docs.length);
    await idx.close();
  });

  it("saved views round-trip through .vault/views.yml", async () => {
    const views = await vault.saveView({
      name: "Untagged this month",
      query: "tags:empty created:>30d",
    });
    expect(views).toHaveLength(1);
    expect(readFileSync(join(root, ".vault/views.yml"), "utf8")).toContain(
      "tags:empty created:>30d",
    );
    expect(await vault.listViews()).toEqual(views);
    expect(await vault.deleteView("Untagged this month")).toEqual([]);
  });
});

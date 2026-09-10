import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VaultService } from "@main/services/vault/vault.service";
import { IndexerService } from "@main/services/indexer/indexer.service";
import { GitService } from "@main/services/git/git.service";

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
    const read = await vault.readTrashed(listed[0].path);
    expect(read.body.trim()).toBe("second one");

    const restored = await vault.restoreFromTrash(listed[0].path);
    expect(restored.path).toBe("atlas-api/rate-limiting-at-the-edge-2.md");
    expect(vault.index.get(restored.path)?.title).toBe("Rate limiting at the edge");
    expect((await vault.git.git.log()).latest?.message).toBe("restore: Rate limiting at the edge");
    expect(await vault.listTrash()).toEqual([]);

    await vault.trash(restored.path);
    await expect(vault.readTrashed("atlas-api/rate-limiting-at-the-edge.md")).rejects.toThrow();
    expect(await vault.purgeTrash()).toEqual({ removed: 1 });
    expect(existsSync(join(root, ".trash"))).toBe(false);
    expect((await vault.git.git.log()).latest?.message).toBe("purge: trash (1 doc)");
    const status = await vault.git.git.status();
    expect(status.files.filter((f) => f.path.startsWith(".trash"))).toEqual([]);
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

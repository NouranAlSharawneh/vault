import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Off the real Spotlight index: the temp workspace below is the only folder in play.
vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import { GitService } from "@main/services/git/git.service";
import { VaultService } from "@main/services/vault/vault.service";
import type { VaultConfig } from "@shared/types";

/**
 * The saves the audit found could lose or misplace text. Each test is named after what
 * used to go wrong, on a small vault of its own.
 */

const doc = (title: string, body: string, extra = ""): string =>
  `# ${title}\n\n${body}\n\n---\n\n\`\`\`yaml\ntitle: ${title}\nproject: Atlas API\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n${extra}\`\`\`\n`;

let root: string;
let cache: string;
let vault: VaultService;

const config = (): VaultConfig => ({
  root,
  remote: null,
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
});

async function open(files: Record<string, string>): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  await GitService.init(root, "main");
  const g = new GitService(root, () => null);
  await g.ensureIdentity("Test", "test@example.com");
  await g.commitAll("seed");
  vault = new VaultService(config(), cache, () => null);
  await vault.open();
}

const git = () => simpleGit({ baseDir: root });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vault-safety-"));
  cache = mkdtempSync(join(tmpdir(), "vault-safety-cache-"));
});

afterEach(async () => {
  await vault?.close();
  rmSync(root, { recursive: true, force: true });
  rmSync(cache, { recursive: true, force: true });
});

describe("saving over a version the editor never saw", () => {
  it("keeps a star made while the document was open, and says it saved on top of a change", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Original.") });
    const loaded = await vault.read("atlas-api/spec.md");
    // Starred from the main window while an editor has it open: a commit of its own.
    await vault.setStarred("atlas-api/spec.md", true);

    const res = await vault.save({
      body: "Edited in the editor.",
      frontmatter: { ...loaded.meta, starred: false },
      existingPath: "atlas-api/spec.md",
      baseHash: loaded.hash,
      commit: true,
    });

    const text = readFileSync(join(root, "atlas-api/spec.md"), "utf8");
    expect(text).toContain("Edited in the editor.");
    expect(text).toContain("starred: true");
    expect(res.preservedExternalEdit).toBe(true);
  });

  it("says nothing when the file is exactly as the editor loaded it", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Original.") });
    const loaded = await vault.read("atlas-api/spec.md");
    const res = await vault.save({
      body: "Edited.",
      frontmatter: loaded.meta,
      existingPath: "atlas-api/spec.md",
      baseHash: loaded.hash,
      commit: true,
    });

    expect(res.preservedExternalEdit).toBe(false);
  });
});

describe("a commit that fails after the file is written", () => {
  it("still says where the file went, so a retry carries on instead of writing a copy", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Original.") });
    const lock = join(root, ".git", "index.lock");
    writeFileSync(lock, "");

    const first = await vault.save({
      body: "# Fresh\n\nNew.",
      frontmatter: { title: "Fresh", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });
    expect(first.commitError).toBeTruthy();
    expect(first.committed).toBe(false);
    expect(first.path).toBe("atlas-api/fresh.md");
    expect(existsSync(join(root, first.path))).toBe(true);

    rmSync(lock);
    const retry = await vault.save({
      body: "# Fresh\n\nNew.",
      frontmatter: { title: "Fresh", project: "Atlas API", tags: [], source: "manual" },
      existingPath: first.path,
      commit: true,
    });
    expect(retry.path).toBe(first.path);
    expect(retry.committed).toBe(true);
    expect(existsSync(join(root, "atlas-api/fresh-2.md"))).toBe(false);
  });
});

describe("images a document already has", () => {
  it("are left where they are on save, not copied in again as -2", async () => {
    await open({
      "atlas-api/spec.md": doc("Spec", "![hero](assets/hero.png)"),
      "atlas-api/assets/hero.png": "png",
    });
    const res = await vault.save({
      body: "![hero](assets/hero.png)\n\nMore.",
      frontmatter: { title: "Spec", project: "Atlas API", tags: ["spec"], source: "manual" },
      existingPath: "atlas-api/spec.md",
      commit: true,
      assets: { baseDir: join(root, "atlas-api"), refs: ["assets/hero.png"] },
    });

    expect(res.assets).toEqual([]);
    expect(existsSync(join(root, "atlas-api/assets/hero-2.png"))).toBe(false);
    expect(readFileSync(join(root, res.path), "utf8")).toContain("](assets/hero.png)");
  });
});

describe("restoring an old version", () => {
  it("brings back the text, and keeps today's star, title and place", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Version one.") });
    const [seed] = await vault.history("atlas-api/spec.md");
    await vault.setStarred("atlas-api/spec.md", true);

    const res = await vault.restore("atlas-api/spec.md", seed.sha);

    const text = readFileSync(join(root, res.path), "utf8");
    expect(res.path).toBe("atlas-api/spec.md");
    expect(text).toContain("Version one.");
    expect(text).toContain("starred: true");
  });

  it("refuses anything that isn't a commit id", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Version one.") });
    await expect(vault.diff("atlas-api/spec.md", "--output=/tmp/x")).rejects.toThrow(
      /Not a commit/,
    );
  });
});

describe("a README that isn't Marasca's", () => {
  it("is never replaced by the index", async () => {
    await open({
      "README.md": "# My project\n\nHand-written front page.\n",
      "atlas-api/spec.md": doc("Spec", "Body."),
    });
    await vault.save({
      body: "# New\n\nText.",
      frontmatter: { title: "New", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });

    expect(readFileSync(join(root, "README.md"), "utf8")).toBe(
      "# My project\n\nHand-written front page.\n",
    );
  });

  it("while one Marasca wrote is kept up to date", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Body.") });
    await vault.save({
      body: "# New\n\nText.",
      frontmatter: { title: "New", project: "Atlas API", tags: [], source: "manual" },
      commit: true,
    });

    expect(readFileSync(join(root, "README.md"), "utf8")).toContain("[New](atlas-api/new.md)");
  });
});

describe("where a document lives", () => {
  it("a note in a nested folder stays there when it is starred", async () => {
    await open({ "research/2024/q1.md": "# Q1\n\nNotes from the quarter.\n" });
    const meta = await vault.setStarred("research/2024/q1.md", true);

    expect(meta.path).toBe("research/2024/q1.md");
    expect(existsSync(join(root, "_inbox"))).toBe(false);
  });

  it("a file with no metadata takes its folder as its project", async () => {
    await open({ "research/note.md": "# A note\n\nNo metadata.\n" });

    expect(vault.index.get("research/note.md")?.project).toBe("Research");
  });

  it("a file with no created date is not stamped 1970", async () => {
    await open({
      "atlas-api/old.md":
        "# Old\n\nBody.\n\n---\n\n```yaml\ntitle: Old\nproject: Atlas API\ntags: []\nsource: manual\n```\n",
    });

    expect(vault.index.get("atlas-api/old.md")?.created.startsWith("1970")).toBe(false);
  });

  it("a rename that isn't committed stages nothing for the next commit to sweep up", async () => {
    await open({ "atlas-api/spec.md": doc("Spec", "Body.") });
    await vault.save({
      body: "Body.",
      frontmatter: { title: "Renamed", project: "Atlas API", tags: [], source: "manual" },
      existingPath: "atlas-api/spec.md",
      commit: false,
    });

    expect((await git().status()).staged).toEqual([]);
  });
});

describe("projects in other scripts", () => {
  it("get folders of their own, and renaming one leaves the other alone", async () => {
    await open({});
    await vault.save({
      body: "# Первый\n\nТекст.",
      frontmatter: { title: "Первый", project: "Проект", tags: [], source: "manual" },
      commit: true,
    });
    await vault.save({
      body: "# 日本\n\n本文。",
      frontmatter: { title: "日本", project: "日本語", tags: [], source: "manual" },
      commit: true,
    });
    const slugs = vault.index.snapshot().projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).not.toContain("untitled");

    await vault.renameProject("Проект", "Renamed");
    expect(vault.index.all().find((d) => d.title === "日本")?.project).toBe("日本語");
  });
});

describe("saved views", () => {
  it("a file that can't be read is not wiped by the next save", async () => {
    await open({ ".vault/views.yml": "views: [ { name: broken" });
    await expect(vault.saveView({ name: "Mine", query: "tags:spec" })).rejects.toThrow();

    expect(readFileSync(join(root, ".vault/views.yml"), "utf8")).toBe("views: [ { name: broken");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@main/services/assets/spotlight", () => ({ spotlightRoots: async () => [] }));
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitService } from "@main/services/git/git.service";
import { LOG_SEP, parseLogPatch } from "@main/services/git/parse-log-patch";
import { VaultService } from "@main/services/vault/vault.service";
import { HISTORY_PAGE } from "@shared/constants";
import type { VaultConfig } from "@shared/types";

const doc = (title: string, body: string): string =>
  `# ${title}\n\n${body}\n\n---\n\n\`\`\`yaml\ntitle: ${title}\nproject: Atlas API\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n\`\`\`\n`;

describe("reading a document's log", () => {
  const header = (sha: string, message: string) =>
    `${LOG_SEP}${sha}${LOG_SEP}2026-09-01T10:00:00Z${LOG_SEP}nunu${LOG_SEP}${message}`;

  it("counts lines, tells a metadata-only commit, and follows a rename", () => {
    const out = [
      header("b".repeat(40), "update: Spec"),
      "",
      "diff --git a/atlas-api/spec.md b/atlas-api/spec.md",
      "--- a/atlas-api/spec.md",
      "+++ b/atlas-api/spec.md",
      "@@ -10 +10 @@",
      "-starred: false",
      "+starred: true",
      header("a".repeat(40), "update: Spec"),
      "",
      "diff --git a/inbox/spec.md b/atlas-api/spec.md",
      "rename from inbox/spec.md",
      "rename to atlas-api/spec.md",
      "--- a/inbox/spec.md",
      "+++ b/atlas-api/spec.md",
      "@@ -3 +3,2 @@",
      // Text that happens to start like a diff header is still text.
      "---- a list item",
      "+++ a heading of plusses",
      "+Written today.",
    ].join("\n");

    const [star, edit] = parseLogPatch(out, "atlas-api/spec.md");
    expect(star).toMatchObject({ added: 1, removed: 1, metaOnly: true });
    expect(edit).toMatchObject({
      added: 2,
      removed: 1,
      metaOnly: false,
      path: "atlas-api/spec.md",
    });
  });
});

describe("a document's history", () => {
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

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), "vault-history-"));
    cache = mkdtempSync(join(tmpdir(), "vault-history-cache-"));
    mkdirSync(join(root, "atlas-api"), { recursive: true });
    writeFileSync(join(root, "atlas-api/spec.md"), doc("Spec", "First draft."));
    await GitService.init(root, "main");
    const g = new GitService(root, () => null);
    await g.ensureIdentity("Test", "test@example.com");
    await g.commitAll("seed");
    vault = new VaultService(config(), cache, () => null);
    await vault.open();
  });

  afterEach(async () => {
    await vault?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(cache, { recursive: true, force: true });
  });

  it("says what each commit did, and which ones only touched the metadata", async () => {
    const loaded = await vault.read("atlas-api/spec.md");
    await vault.setStarred("atlas-api/spec.md", true);
    await vault.save({
      body: "First draft.\n\nA second paragraph.",
      frontmatter: { ...loaded.meta, starred: true },
      existingPath: "atlas-api/spec.md",
      commit: true,
    });

    const [edit, star, seed] = await vault.history("atlas-api/spec.md");
    expect(edit.metaOnly).toBe(false);
    expect(edit.added).toBeGreaterThan(0);
    expect(star.metaOnly).toBe(true);
    expect(seed.metaOnly).toBe(false);
  });

  it("pages further back than the first page", async () => {
    // Only the seed commit exists: a second page starts past it and finds nothing.
    expect(await vault.history("atlas-api/spec.md")).toHaveLength(1);
    expect(await vault.history("atlas-api/spec.md", HISTORY_PAGE)).toEqual([]);
  });

  it("compares a version with the file as it is now", async () => {
    const [seed] = await vault.history("atlas-api/spec.md");
    const loaded = await vault.read("atlas-api/spec.md");
    await vault.save({
      body: "Rewritten entirely.",
      frontmatter: loaded.meta,
      existingPath: "atlas-api/spec.md",
      commit: true,
    });

    const since = await vault.compare("atlas-api/spec.md", seed.sha);
    expect(since).toContain("-First draft.");
    expect(since).toContain("+Rewritten entirely.");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dir = { path: "" };
vi.mock("electron", () => ({ app: { getPath: () => dir.path } }));

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearDraft,
  findOrphanedUntitledDraft,
  loadDraft,
  newUntitledDraftKey,
  saveDraft,
} from "@main/store/draft.store";
import type { StoredDraft } from "@shared/types";

const draft = (body: string, at = "2026-01-01T10:00:00Z"): StoredDraft => ({
  body,
  meta: { title: "Spec", project: "Atlas API", tags: [], source: "manual" },
  at,
});

describe("draft store", () => {
  beforeEach(() => {
    dir.path = mkdtempSync(join(tmpdir(), "vault-drafts-"));
  });

  afterEach(() => {
    rmSync(dir.path, { recursive: true, force: true });
  });

  it("gives back what was parked", () => {
    saveDraft("atlas/spec.md", draft("half a thought"));

    expect(loadDraft("atlas/spec.md")).toMatchObject({ body: "half a thought" });
  });

  it("keeps one draft per editor target", () => {
    saveDraft("atlas/spec.md", draft("one"));
    saveDraft("inbox/note.md", draft("two"));

    expect(loadDraft("atlas/spec.md")).toMatchObject({ body: "one" });
    expect(loadDraft("inbox/note.md")).toMatchObject({ body: "two" });
  });

  it("has nothing for a target that was never typed in", () => {
    expect(loadDraft("nothing/here.md")).toBeNull();
  });

  it("forgets a draft once its text became a real save", () => {
    saveDraft("atlas/spec.md", draft("half a thought"));
    clearDraft("atlas/spec.md");

    expect(loadDraft("atlas/spec.md")).toBeNull();
    expect(() => clearDraft("atlas/spec.md")).not.toThrow();
  });

  it("hashes the key, so a path cannot write outside the drafts folder", () => {
    saveDraft("../../../etc/passwd", draft("nope"));
    const files = readdirSync(join(dir.path, "drafts"));

    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^[0-9a-f]{40}\.json$/);
    expect(loadDraft("../../../etc/passwd")).toMatchObject({ body: "nope" });
  });

  it("treats a corrupt draft file as no draft at all", () => {
    saveDraft("atlas/spec.md", draft("good"));
    const [file] = readdirSync(join(dir.path, "drafts"));
    writeFileSync(join(dir.path, "drafts", file), "{ not json");

    expect(loadDraft("atlas/spec.md")).toBeNull();
  });

  it("ignores a draft file that has no body", () => {
    saveDraft("atlas/spec.md", draft("good"));
    const [file] = readdirSync(join(dir.path, "drafts"));
    writeFileSync(join(dir.path, "drafts", file), JSON.stringify({ at: "2026-01-01" }));

    expect(loadDraft("atlas/spec.md")).toBeNull();
  });

  it("gives every untitled window a key of its own", () => {
    const a = newUntitledDraftKey();
    const b = newUntitledDraftKey();

    expect(a).toMatch(/^untitled:/);
    expect(a).not.toBe(b);
  });

  it("records the key inside the file, so drafts can be listed back", () => {
    saveDraft("untitled:a", draft("parked"));
    const [file] = readdirSync(join(dir.path, "drafts"));

    expect(JSON.parse(readFileSync(join(dir.path, "drafts", file), "utf8"))).toMatchObject({
      key: "untitled:a",
    });
  });

  describe("an untitled draft left behind", () => {
    it("is found when no open window holds it", () => {
      saveDraft("untitled:a", draft("left behind"));

      expect(findOrphanedUntitledDraft(new Set())).toBe("untitled:a");
    });

    it("is not handed out while a window still has it", () => {
      saveDraft("untitled:a", draft("still open"));

      expect(findOrphanedUntitledDraft(new Set(["untitled:a"]))).toBeNull();
    });

    it("is never a document's draft, which reopens with the document instead", () => {
      saveDraft("atlas/spec.md", draft("edits to a real file"));

      expect(findOrphanedUntitledDraft(new Set())).toBeNull();
    });

    it("is not worth recovering when it has no text", () => {
      saveDraft("untitled:a", draft("  \n"));

      expect(findOrphanedUntitledDraft(new Set())).toBeNull();
    });

    it("comes back newest first", () => {
      saveDraft("untitled:old", draft("older", "2026-01-01T10:00:00Z"));
      saveDraft("untitled:new", draft("newer", "2026-03-01T10:00:00Z"));

      expect(findOrphanedUntitledDraft(new Set())).toBe("untitled:new");
      expect(findOrphanedUntitledDraft(new Set(["untitled:new"]))).toBe("untitled:old");
    });

    it("includes the one every new window used to share, which never recorded its key", () => {
      const legacy = createHash("sha1").update("new").digest("hex");
      mkdirSync(join(dir.path, "drafts"), { recursive: true });
      writeFileSync(
        join(dir.path, "drafts", `${legacy}.json`),
        JSON.stringify(draft("from before the update")),
      );

      expect(findOrphanedUntitledDraft(new Set())).toBe("new");
      expect(loadDraft("new")).toMatchObject({ body: "from before the update" });
    });

    it("skips a file it cannot read", () => {
      saveDraft("untitled:a", draft("good"));
      writeFileSync(join(dir.path, "drafts", "junk.json"), "{ not json");

      expect(findOrphanedUntitledDraft(new Set())).toBe("untitled:a");
    });

    it("has nothing to offer before any draft was ever parked", () => {
      expect(findOrphanedUntitledDraft(new Set())).toBeNull();
    });
  });
});

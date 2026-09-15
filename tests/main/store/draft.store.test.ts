import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dir = { path: "" };
vi.mock("electron", () => ({ app: { getPath: () => dir.path } }));

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearDraft, loadDraft, saveDraft } from "@main/store/draft.store";
import type { StoredDraft } from "@shared/types";

const draft = (body: string): StoredDraft => ({
  body,
  meta: { title: "Spec", project: "Atlas API", tags: [], source: "manual" },
  at: "2026-01-01T10:00:00Z",
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
});

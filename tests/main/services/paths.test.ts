import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertInside,
  assertInTrash,
  freeName,
  freeRelPath,
  insideVault,
} from "@main/services/fs/paths";

const root = mkdtempSync(join(tmpdir(), "paths-"));

describe("staying inside the vault", () => {
  it("accepts a path that lands in the folder", () => {
    expect(insideVault(root, "atlas-api/spec.md")).toBe(join(root, "atlas-api/spec.md"));
    expect(insideVault(root, ".")).toBe(root);
  });

  it("refuses one that climbs out, however it is spelled", () => {
    // `../x.md` was caught by accident elsewhere; this is the one that got through.
    expect(insideVault(root, "sub/../../../secret.md")).toBeNull();
    expect(insideVault(root, "../secret.md")).toBeNull();
    expect(insideVault(root, "/etc/passwd")).toBeNull();
    expect(() => assertInside(root, "sub/../../../secret.md")).toThrow(/Outside the vault/);
  });

  it("is not fooled by a sibling folder whose name starts the same", () => {
    expect(insideVault("/vault", "../vault-backup/x.md")).toBeNull();
  });

  it("knows a trashed path from a document one", () => {
    expect(() => assertInTrash(".trash/atlas-api/spec.md")).not.toThrow();
    expect(() => assertInTrash("atlas-api/spec.md")).toThrow(/Not a trashed/);
    expect(() => assertInTrash(".trash/../atlas-api/spec.md")).toThrow(/Not a trashed/);
  });
});

describe("finding a free name", () => {
  it("takes the plain name when nothing is using it", () => {
    const dir = mkdtempSync(join(tmpdir(), "free-"));
    expect(freeName(dir, "spec", ".md")).toBe("spec.md");
    rmSync(dir, { recursive: true, force: true });
  });

  it("counts up past the ones that exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "free-"));
    writeFileSync(join(dir, "spec.md"), "");
    writeFileSync(join(dir, "spec-2.md"), "");
    expect(freeName(dir, "spec", ".md")).toBe("spec-3.md");
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the name a file already has, so saving over yourself is not a rename", () => {
    const dir = mkdtempSync(join(tmpdir(), "free-"));
    writeFileSync(join(dir, "spec.md"), "");
    expect(freeName(dir, "spec", ".md", { keep: "spec.md" })).toBe("spec.md");
    rmSync(dir, { recursive: true, force: true });
  });

  it("works on a repo-relative path, extension and all", () => {
    mkdirSync(join(root, "atlas-api"), { recursive: true });
    writeFileSync(join(root, "atlas-api/hero.png"), "");
    expect(freeRelPath(root, "atlas-api/hero.png")).toBe("atlas-api/hero-2.png");
    expect(freeRelPath(root, "atlas-api/other.png")).toBe("atlas-api/other.png");
  });
});

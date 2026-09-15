import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { TRASH_DIR } from "@shared/constants";

/**
 * Every path the renderer hands us is joined onto the vault root, so every one of them
 * has to be proved to land inside it. `../x.md` was caught by accident — the indexer
 * refuses a path starting with a dot — but `sub/../../../x.md` passed, and `read` would
 * return the file, index it, and write its path into the README that gets pushed.
 *
 * The asset protocol has always done this. The document paths had not.
 */
export function insideVault(root: string, relPath: string): string | null {
  const abs = resolve(root, relPath);

  return abs === root || abs.startsWith(root.endsWith(sep) ? root : root + sep) ? abs : null;
}

/** The throwing form, for the service methods a renderer path reaches directly. */
export function assertInside(root: string, relPath: string): string {
  const abs = insideVault(root, relPath);

  if (!abs) throw new Error(`Outside the vault: ${relPath}`);

  return abs;
}

export function assertInTrash(path: string): void {
  if (!path.startsWith(`${TRASH_DIR}/`) || path.includes("..")) {
    throw new Error(`Not a trashed document: ${path}`);
  }
}

/**
 * The first name in `dir` that nothing is using: `spec.md`, then `spec-2.md`, and so on.
 *
 * This rule was written out by hand in four places — twice in the vault service, once
 * inside the project-rename walk and once in the asset importer — with three different
 * tie-breaker conventions between them. One of anything is easier to reason about than
 * four spellings that have already drifted.
 */
export function freeName(
  dir: string,
  stem: string,
  ext: string,
  opts: { from?: number; keep?: string } = {},
): string {
  const { from = 2, keep } = opts;
  const first = `${stem}${ext}`;

  if (first === keep || !existsSync(join(dir, first))) return first;

  for (let i = from; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;

    if (candidate === keep || !existsSync(join(dir, candidate))) return candidate;
  }

  throw new Error(`No free name left beside ${stem}${ext}`);
}

/** `freeName` for a repo-relative path rather than a name in a directory. */
export function freeRelPath(root: string, relPath: string, keep?: string): string {
  const slash = relPath.lastIndexOf("/");
  const dir = slash < 0 ? "" : relPath.slice(0, slash);
  const name = slash < 0 ? relPath : relPath.slice(slash + 1);
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  const keepName =
    keep && dir === (keep.lastIndexOf("/") < 0 ? "" : keep.slice(0, keep.lastIndexOf("/")))
      ? keep.slice(keep.lastIndexOf("/") + 1)
      : undefined;

  const free = freeName(join(root, dir), stem, ext, { keep: keepName });

  return dir ? `${dir}/${free}` : free;
}

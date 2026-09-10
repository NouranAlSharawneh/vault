import { promises as fs, existsSync } from "node:fs";
import { join, sep } from "node:path";
import { ASSETS_DIR, TRASH_DIR } from "@shared/constants";
import { docAssetPath, findAssetRefs } from "@shared/helpers";

/**
 * Files under `assets/` that only the documents being deleted were pointing at.
 *
 * Trashing a doc leaves its images where they are, because a restore has to find them again
 * and the reader falls back to the original folder for a trashed doc. That means a purge is
 * the only moment they can go — and if it doesn't take them, they stay in the repo forever,
 * invisible, with nothing left that mentions them.
 *
 * Deleting is not reversible, so this is deliberately conservative: an asset survives if any
 * other markdown file in the vault still refers to it, including one sitting in the trash
 * that might yet be restored. Only files inside an `assets/` folder are ever candidates —
 * a doc pointing at a hand-placed image elsewhere in the repo is not the owner of it.
 */
export async function orphanedAssets(root: string, purged: string[]): Promise<string[]> {
  const doomed = new Set<string>();
  for (const path of purged) {
    for (const asset of await assetsOf(root, path)) doomed.add(asset);
  }
  if (!doomed.size) return [];

  const purgedSet = new Set(purged);
  for (const path of await markdownFiles(root)) {
    if (purgedSet.has(path)) continue;
    for (const asset of await assetsOf(root, path)) doomed.delete(asset);
    if (!doomed.size) return [];
  }
  return [...doomed];
}

/** The in-vault `assets/` paths one document points at, both spellings for a trashed doc. */
async function assetsOf(root: string, docPath: string): Promise<string[]> {
  let body: string;
  try {
    body = await fs.readFile(join(root, docPath), "utf8");
  } catch {
    return []; // already gone, or not readable — it cannot be keeping anything alive
  }
  const out: string[] = [];
  for (const ref of findAssetRefs(body)) {
    const path = docAssetPath(ref, docPath);
    if (!path) continue;
    // A trashed doc still points at `assets/…` next to where it used to live, so the file
    // it means may be under `.trash/` or back at the original path. Whichever one is
    // actually on disk is the file being talked about; a link to nothing protects nothing.
    for (const candidate of [path, untrashed(path)]) {
      if (!candidate || !candidate.split("/").includes(ASSETS_DIR)) continue;
      if (existsSync(join(root, candidate))) out.push(candidate);
    }
  }
  return out;
}

function untrashed(path: string): string | null {
  return path.startsWith(`${TRASH_DIR}/`) ? path.slice(TRASH_DIR.length + 1) : null;
}

/** Every `.md` in the vault, `.git` aside — the trash included, since a restore can revive it. */
async function markdownFiles(root: string, dir = root): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== ".git") out.push(...(await markdownFiles(root, abs)));
    } else if (e.name.toLowerCase().endsWith(".md")) {
      out.push(
        abs
          .slice(root.length + 1)
          .split(sep)
          .join("/"),
      );
    }
  }
  return out;
}

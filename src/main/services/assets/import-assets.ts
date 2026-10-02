import { promises as fs, existsSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { ASSET_MAX_BYTES, ASSETS_DIR } from "@shared/constants";
import { slugify } from "@shared/helpers";
import type { AssetImport } from "@shared/types";
import type { ImportedAssets } from "./assets.types";
import { refPath } from "./resolve-assets";

/**
 * Copy referenced files into `<docFolder>/assets/` (slugified, de-duplicated names) and
 * return how the body should be rewritten. Refs that don't exist are skipped, not fatal.
 *
 * A ref that already resolves inside the document's own folder is left alone: it is
 * where it belongs, and copying it made `x-2.png` beside `x.png` on every save of a
 * document that was already in the vault. Anything over GitHub's limit is skipped too.
 * If a copy fails part-way, the files already copied are taken back out, so a retry
 * does not find them in the way and name its own copies `-2`.
 */
export async function importAssets(
  root: string,
  docFolder: string,
  req: AssetImport,
): Promise<ImportedAssets> {
  const home = join(root, docFolder);
  const dir = join(home, ASSETS_DIR);
  const map: Record<string, string> = {};
  const paths: string[] = [];
  try {
    for (const ref of req.refs) {
      // Only inside the folder the refs are relative to: never `../../` out of it.
      const src = refPath(req.baseDir, ref);
      if (!src || !existsSync(src) || isWithin(home, src)) continue;
      if (statSync(src).size > ASSET_MAX_BYTES) continue;
      await fs.mkdir(dir, { recursive: true });
      const name = uniqueName(dir, basename(ref));
      await fs.copyFile(src, join(dir, name));
      map[ref] = `${ASSETS_DIR}/${name}`;
      paths.push(`${docFolder}/${ASSETS_DIR}/${name}`);
    }
  } catch (e) {
    await Promise.all(paths.map((p) => fs.rm(join(root, p), { force: true })));
    throw e;
  }

  return { map, paths };
}

function isWithin(dir: string, path: string): boolean {
  const rel = relative(dir, path);

  return !!rel && !rel.startsWith("..") && !isAbsolute(rel);
}

function uniqueName(dir: string, original: string): string {
  const ext = extname(original).toLowerCase();
  const stem = slugify(original.slice(0, original.length - ext.length)) || "asset";
  if (!existsSync(join(dir, stem + ext))) return stem + ext;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existsSync(join(dir, candidate))) return candidate;
  }
  throw new Error(`Could not find a free name for ${original}`);
}

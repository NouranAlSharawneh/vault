import { promises as fs, existsSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import { ASSETS_DIR } from "@shared/constants";
import { slugify } from "@shared/helpers";
import type { AssetImport } from "@shared/types";
import type { ImportedAssets } from "./assets.types";

/**
 * Copy referenced files into `<docFolder>/assets/` (slugified, de-duplicated names) and
 * return how the body should be rewritten. Refs that don't exist are skipped, not fatal.
 */
export async function importAssets(
  root: string,
  docFolder: string,
  req: AssetImport,
): Promise<ImportedAssets> {
  const dir = join(root, docFolder, ASSETS_DIR);
  const map: Record<string, string> = {};
  const paths: string[] = [];
  for (const ref of req.refs) {
    const src = isAbsolute(ref) ? ref : resolve(req.baseDir, ref);
    if (!existsSync(src)) continue;
    await fs.mkdir(dir, { recursive: true });
    const name = uniqueName(dir, basename(ref));
    await fs.copyFile(src, join(dir, name));
    map[ref] = `${ASSETS_DIR}/${name}`;
    paths.push(`${docFolder}/${ASSETS_DIR}/${name}`);
  }
  return { map, paths };
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

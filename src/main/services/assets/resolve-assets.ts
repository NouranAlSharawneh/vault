import { promises as fs } from "node:fs";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { ASSET_MIME } from "@shared/constants";
import { normalizeRef } from "@shared/helpers";
import type { AssetRef, AssetResolution } from "@shared/types";
import { findAssetRoot } from "./find-asset-root";

/**
 * Check each relative ref against a base folder: does it exist, how big, do we serve its type.
 *
 * With no folder to check against, one is looked for rather than giving up — a capture pasted
 * as plain text carries no path of its own, and asking the user to point at their own project
 * folder every time is a question Marasca can usually answer itself. `known` seeds that search
 * with the folders already remembered for other projects.
 */
export async function resolveAssets(
  baseDir: string | null,
  refs: string[],
  known: string[] = [],
): Promise<AssetResolution> {
  if (baseDir) {
    const given = await Promise.all(refs.map((ref) => describe(ref, baseDir)));
    // A folder remembered for this project that holds none of these is another repo's:
    // look for the right one instead of reporting every image missing.
    if (given.some((r) => r.status === "found") || !refs.length)
      return { baseDir, detected: false, refs: given };
  }
  const detected = refs.length ? await findAssetRoot(refs, known) : null;
  const dir = detected ?? baseDir;

  return {
    baseDir: dir,
    detected: !!detected,
    refs: await Promise.all(refs.map((ref) => describe(ref, dir))),
  };
}

/** Where a ref points under `baseDir`, or null when it points outside it. */
export function refPath(baseDir: string, ref: string): string | null {
  const abs = resolve(baseDir, normalizeRef(ref));
  const rel = relative(baseDir, abs);

  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? abs : null;
}

async function describe(ref: string, baseDir: string | null): Promise<AssetRef> {
  const name = basename(ref);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in ASSET_MIME)) return { ref, name, status: "unsupported", bytes: 0 };
  if (!baseDir) return { ref, name, status: "unknown", bytes: 0 };
  const abs = refPath(baseDir, ref);
  if (!abs) return { ref, name, status: "outside", bytes: 0 };
  try {
    const st = await fs.stat(abs);

    return st.isFile()
      ? { ref, name, status: "found", bytes: st.size }
      : { ref, name, status: "missing", bytes: 0 };
  } catch {
    return { ref, name, status: "missing", bytes: 0 };
  }
}

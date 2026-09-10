import { promises as fs } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { ASSET_MIME } from "@shared/constants";
import type { AssetRef, AssetResolution } from "@shared/types";
import { findAssetRoot } from "./find-asset-root";

/**
 * Check each relative ref against a base folder: does it exist, how big, do we serve its type.
 *
 * With no folder to check against, one is looked for rather than giving up — a capture pasted
 * as plain text carries no path of its own, and asking the user to point at their own project
 * folder every time is a question Vault can usually answer itself. `known` seeds that search
 * with the folders already remembered for other projects.
 */
export async function resolveAssets(
  baseDir: string | null,
  refs: string[],
  known: string[] = [],
): Promise<AssetResolution> {
  const detected = !baseDir && refs.length ? await findAssetRoot(refs, known) : null;
  const dir = baseDir ?? detected;
  return {
    baseDir: dir,
    detected: !!detected,
    refs: await Promise.all(refs.map((ref) => describe(ref, dir))),
  };
}

async function describe(ref: string, baseDir: string | null): Promise<AssetRef> {
  const name = basename(ref);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ext in ASSET_MIME)) return { ref, name, status: "unsupported", bytes: 0 };
  if (!baseDir) return { ref, name, status: "unknown", bytes: 0 };
  try {
    const abs = isAbsolute(ref) ? ref : resolve(baseDir, ref);
    const st = await fs.stat(abs);
    return st.isFile()
      ? { ref, name, status: "found", bytes: st.size }
      : { ref, name, status: "missing", bytes: 0 };
  } catch {
    return { ref, name, status: "missing", bytes: 0 };
  }
}

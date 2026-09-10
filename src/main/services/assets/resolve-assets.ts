import { promises as fs } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";
import { ASSET_MIME } from "@shared/constants";
import type { AssetRef } from "@shared/types";

/** Check each relative ref against a base folder: does it exist, how big, do we serve its type. */
export async function resolveAssets(baseDir: string | null, refs: string[]): Promise<AssetRef[]> {
  return Promise.all(
    refs.map(async (ref): Promise<AssetRef> => {
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
    }),
  );
}

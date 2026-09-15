import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DocMeta } from "@shared/types";
import type { CacheEntry, CacheFile } from "./indexer.types";

/**
 * The index on disk, so a second launch doesn't re-read the whole vault. Best-effort
 * throughout: the repo is the source of truth, so a missing, stale or corrupt cache
 * costs a rescan and nothing else — which is why nothing in here throws.
 */
export class IndexCache {
  constructor(
    private readonly root: string,
    private readonly dir: string,
  ) {}

  private path(): string {
    const id = createHash("sha1").update(this.root).digest("hex").slice(0, 12);

    return join(this.dir, `index-${id}.json`);
  }

  read(): CacheFile | null {
    try {
      const c = JSON.parse(readFileSync(this.path(), "utf8")) as CacheFile;

      return c.version === 1 ? c : null;
    } catch {
      return null;
    }
  }

  write(docs: Map<string, DocMeta>, headSha: string | null): void {
    try {
      mkdirSync(this.dir, { recursive: true });
      const files: Record<string, CacheEntry> = {};
      for (const [p, m] of docs)
        files[p] = { mtime: m.mtime, size: m.size, meta: { ...m, unpushed: undefined } };
      const cache: CacheFile = { version: 1, headSha, files };
      writeFileSync(this.path(), JSON.stringify(cache));
    } catch {
      /* cache is best-effort */
    }
  }
}

/**
 * Bumped when what a cached entry means changes, so an older cache is read as absent
 * and costs one cold scan rather than serving stale meaning. 2: files without metadata
 * take their folder as project, and a missing `created` is the file's birth time.
 */
export const CACHE_VERSION = 2;

import type { DocMeta } from "@shared/types";

export interface CacheEntry {
  mtime: number;
  size: number;
  meta: DocMeta;
}

export interface CacheFile {
  version: typeof CACHE_VERSION;
  headSha: string | null;
  files: Record<string, CacheEntry>;
}

export interface SearchDoc {
  id: string;
  title: string;
  tags: string;
  project: string;
  body: string;
}

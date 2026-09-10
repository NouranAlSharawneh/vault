import type { DocMeta } from "@shared/types";

export interface CacheEntry {
  mtime: number;
  size: number;
  meta: DocMeta;
}

export interface CacheFile {
  version: 1;
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

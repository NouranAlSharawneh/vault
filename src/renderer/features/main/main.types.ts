import type { DocContent } from "@shared/types";

/** Result of the last document load, keyed by path so stale loads are ignored. */
export interface LoadedDocument {
  path: string;
  doc: DocContent | null;
}

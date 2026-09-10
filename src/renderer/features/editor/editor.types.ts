import type { DocMeta, EditorDraft, Source } from "@shared/types";

/** Everything the metadata bar edits. */
export interface DraftMeta {
  title: string;
  project: string;
  tags: string[];
  source: Source;
  starred: boolean;
}

export interface DraftState {
  body: string;
  meta: DraftMeta;
  /** Path of the doc being edited, null for a new document. */
  existingPath: string | null;
  created: string | null;
  /** True once the user typed anything since the last save/load. */
  dirty: boolean;
  /** Where the draft text came from on disk, if anywhere (relative images resolve there). */
  sourcePath: string | null;
}

export type SaveMode = "local" | "commit";

export interface EditorOpenPayload {
  path?: string;
  draft?: EditorDraft;
}

export const emptyMeta = (source: Source): DraftMeta => ({
  title: "",
  project: "",
  tags: [],
  source,
  starred: false,
});

export const metaFromDoc = (m: DocMeta): DraftMeta => ({
  title: m.title,
  project: m.project,
  tags: m.tags,
  source: m.source,
  starred: !!m.starred,
});

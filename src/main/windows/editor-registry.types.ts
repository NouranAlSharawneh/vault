import type { EditorDraft } from "@shared/types";

/** What main knows about one open editor window. */
export interface EditorEntry {
  /** The document it holds, or null while it is untitled. */
  path: string | null;
  /** Where an untitled window parks its text; null for a window opened on a document. */
  draftKey: string | null;
  /** Text it was opened with, until the window asks for it. */
  seed?: EditorDraft | null;
}

/** Where `openEditorWindow` should point a window. */
export interface EditorTarget {
  path?: string;
  /** Text to start an untitled window with (from the capture sheet). */
  draft?: EditorDraft;
}

export interface ImportedAssets {
  /** Original ref → new path relative to the document. */
  map: Record<string, string>;
  /** Repo-relative paths written, for the commit. */
  paths: string[];
}

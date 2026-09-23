import type { SaveMode } from "../../editor.types";

export interface EditorFooterProps {
  pathPreview: string;
  hasRemote: boolean;
  saving: SaveMode | null;
  canSave: boolean;
  dirty: boolean;
  /** The document exists on disk. A new one that was never saved has nothing to call saved. */
  persisted: boolean;
  error: string | null;
  /** The last save found a newer file on disk and committed that version first. */
  keptOtherVersion: boolean;
  onSave: (mode: SaveMode) => void;
}

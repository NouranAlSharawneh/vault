import type { SaveMode } from "../../editor.types";

export interface EditorFooterProps {
  pathPreview: string;
  hasRemote: boolean;
  saving: SaveMode | null;
  canSave: boolean;
  dirty: boolean;
  error: string | null;
  /** The last save found a newer file on disk and committed that version first. */
  keptOtherVersion: boolean;
  onSave: (mode: SaveMode) => void;
}

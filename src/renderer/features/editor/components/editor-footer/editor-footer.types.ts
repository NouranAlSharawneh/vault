import type { SaveMode } from "../../editor.types";

export interface EditorFooterProps {
  pathPreview: string;
  hasRemote: boolean;
  saving: SaveMode | null;
  canSave: boolean;
  dirty: boolean;
  error: string | null;
  onSave: (mode: SaveMode) => void;
}

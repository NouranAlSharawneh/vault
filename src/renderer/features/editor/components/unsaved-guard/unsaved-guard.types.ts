export interface UnsavedGuardProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

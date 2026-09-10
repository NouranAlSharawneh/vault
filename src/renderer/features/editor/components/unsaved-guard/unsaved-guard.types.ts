export interface UnsavedGuardProps {
  dirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

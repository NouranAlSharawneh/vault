export interface UnsavedGuardProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
  /** The save started from here is still running. */
  saving: boolean;
  /**
   * Why the last save failed. The footer shows it too, but the backdrop covers the
   * footer, so without it here Save looked like it did nothing at all.
   */
  error: string | null;
}

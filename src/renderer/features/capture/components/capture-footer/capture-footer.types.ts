import type { CapturePhase } from "../../capture.types";
import type { CaptureAction } from "../capture-actions/capture-actions.types";

export interface CaptureFooterProps {
  /** Where the doc will land, e.g. `_inbox/vault.md`. */
  pathPreview: string;
  /** The project as typed; empty means the inbox. */
  project: string;
  phase: CapturePhase;
  error: string | null;
  savedPath: string | null;
  /** The primary button's words: "Save & commit", "Save", or "Save anyway". */
  saveLabel: string;
  /** Everything in the ⌘K menu, the primary save included. */
  actions: CaptureAction[];
  actionsOpen: boolean;
  onActionsOpenChange: (open: boolean) => void;
  /** `reveal`: also open the saved doc in Marasca (⌥-click). */
  onSave: (reveal: boolean) => void;
  onRetry: () => void;
}

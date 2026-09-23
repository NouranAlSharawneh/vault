import type { CapturePhase } from "../../capture.types";

export interface CaptureFooterProps {
  pathPreview: string;
  phase: CapturePhase;
  error: string | null;
  savedPath: string | null;
  hasRemote: boolean;
  /** Referenced images that won't be copied, so the save leaves broken links. */
  stranded: number;
  onOpenEditor: () => void;
  /** `reveal`: also open the saved doc in Vault (⌥⌘↵, or ⌥-click). */
  onSave: (reveal: boolean) => void;
  onRetry: () => void;
}

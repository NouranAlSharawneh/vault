import type { CapturePhase } from "../../capture.types";

export interface CaptureFooterProps {
  pathPreview: string;
  phase: CapturePhase;
  error: string | null;
  savedPath: string | null;
  hasRemote: boolean;
  onOpenEditor: () => void;
  onSave: () => void;
  onRetry: () => void;
}

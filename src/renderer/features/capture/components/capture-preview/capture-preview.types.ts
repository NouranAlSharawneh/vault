import type { ClipboardCapture } from "@shared/types";

export interface CapturePreviewProps {
  clip: ClipboardCapture;
  /** Shorter when something else (the asset panel) needs the room. */
  compact?: boolean;
}

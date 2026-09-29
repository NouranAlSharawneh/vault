import type { ClipboardCapture } from "@shared/types";
import type { ClipVariant } from "../../capture.types";

export interface CapturePreviewProps {
  clip: ClipboardCapture;
  /** The text to show: the clip as copied, or its conversion. */
  text: string;
  variant: ClipVariant;
  onVariant: (variant: ClipVariant) => void;
  /** Shorter when something else (the asset panel) needs the room. */
  compact?: boolean;
}

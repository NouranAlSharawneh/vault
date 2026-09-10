import type { ClipboardCapture, Source } from "@shared/types";

export type CapturePhase = "empty" | "ready" | "saving" | "saved" | "error";

export interface CaptureForm {
  project: string;
  source: Source;
  tags: string[];
}

export interface CaptureState {
  clip: ClipboardCapture | null;
  form: CaptureForm;
  phase: CapturePhase;
  error: string | null;
  savedPath: string | null;
  pathPreview: string;
}

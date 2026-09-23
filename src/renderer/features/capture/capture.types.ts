import type { ClipboardCapture, Source } from "@shared/types";

/** `loading`: the sheet is up but the clipboard hasn't been read yet — show nothing loud. */
export type CapturePhase = "loading" | "empty" | "ready" | "saving" | "saved" | "error";

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

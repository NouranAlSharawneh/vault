import type { ClipboardCapture, Source } from "@shared/types";

/** `loading`: the sheet is up but the clipboard hasn't been read yet — show nothing loud. */
export type CapturePhase = "loading" | "empty" | "ready" | "saving" | "saved" | "error";

/** Which text is saved when a copied web page came with its HTML: as copied, or converted. */
export type ClipVariant = "raw" | "converted";

export interface CaptureForm {
  title: string;
  /** Typed by hand, so it stops following the text (a switch to Converted, say). */
  titleEdited: boolean;
  project: string;
  source: Source;
  tags: string[];
  variant: ClipVariant;
}

export interface CaptureState {
  clip: ClipboardCapture | null;
  form: CaptureForm;
  phase: CapturePhase;
  error: string | null;
  savedPath: string | null;
  pathPreview: string;
}

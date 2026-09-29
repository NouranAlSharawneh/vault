import type { CaptureForm } from "../../capture.types";

export interface CaptureFieldsProps {
  form: CaptureForm;
  onChange: (patch: Partial<CaptureForm>) => void;
  projects: string[];
  tags: string[];
  lastProject: string | null;
  detected: boolean;
  /** Projects numbered ⌘1–⌘9, most recent first. */
  shortcuts: string[];
  /** Vault tags this clip talks about, offered one click away. */
  suggestedTags: string[];
  onAddTag: (tag: string) => void;
}

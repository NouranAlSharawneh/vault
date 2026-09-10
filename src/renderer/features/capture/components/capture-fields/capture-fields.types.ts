import type { CaptureForm } from "../../capture.types";

export interface CaptureFieldsProps {
  form: CaptureForm;
  onChange: (patch: Partial<CaptureForm>) => void;
  projects: string[];
  tags: string[];
  lastProject: string | null;
  detected: boolean;
}

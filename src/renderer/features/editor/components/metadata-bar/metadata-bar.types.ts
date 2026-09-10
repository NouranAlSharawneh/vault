import type { DraftMeta } from "../../editor.types";

export interface MetadataBarProps {
  meta: DraftMeta;
  inferredTitle: string;
  onChange: (patch: Partial<DraftMeta>) => void;
  projects: string[];
  tags: string[];
  lastProject: string | null;
}

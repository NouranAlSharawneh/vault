import type { Source } from "@shared/types";

export interface SourceSelectProps {
  value: Source;
  onChange: (source: Source) => void;
  dark?: boolean;
  hint?: string;
}

import type { DocMeta } from "@shared/types";

export interface DocumentListProps {
  docs: DocMeta[];
  selected: string | null;
  onSelect: (path: string) => void;
}

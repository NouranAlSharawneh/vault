import type { DocMeta } from "@shared/types";

export interface DocumentRowProps {
  doc: DocMeta;
  selected: boolean;
  /** The id the list points `aria-activedescendant` at. */
  id: string;
  /** What the row's time says — already formatted, so the row only redraws when it changes. */
  when: string;
  onSelect: (path: string) => void;
  onOpen: (path: string) => void;
}

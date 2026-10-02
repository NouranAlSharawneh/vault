import type { DocMeta } from "@shared/types";

/** How a row was clicked: ⌘ adds or removes it, ⇧ takes everything up to it. */
export interface RowClick {
  toggle: boolean;
  range: boolean;
}

export interface DocumentRowProps {
  doc: DocMeta;
  /** In the reader: the one the selection is anchored on. */
  selected: boolean;
  /** Picked along with others for a bulk action. */
  picked?: boolean;
  /** The id the list points `aria-activedescendant` at. */
  id: string;
  /** What the row's time says — already formatted, so the row only redraws when it changes. */
  when: string;
  onActivate: (path: string, click: RowClick) => void;
  onOpen: (path: string) => void;
  /** Right-click: the row's menu. */
  onMenu?: (path: string) => void;
  /** A click on one of the row's tags: show only documents with it. */
  onTag?: (tag: string) => void;
}

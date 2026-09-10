import type { DocMeta } from "@shared/types";
import type { ReaderView } from "../../main.types";

export interface ReaderToolbarProps {
  doc: DocMeta | null;
  view: ReaderView;
  onView: (v: ReaderView) => void;
  onStar: () => void;
}

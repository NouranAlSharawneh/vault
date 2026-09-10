import type { DocContent } from "@shared/types";
import type { ReaderView } from "../../main.types";

export interface DocumentReaderProps {
  doc: DocContent | null;
  view: ReaderView;
  onView: (v: ReaderView) => void;
  onStar: () => void;
  onTrash: () => void;
  trashed?: boolean;
  onRestore: () => void;
  onPurge: () => void;
}

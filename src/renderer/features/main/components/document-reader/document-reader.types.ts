import type { DocContent } from "@shared/types";
import type { ReaderView, TrashAction } from "../../main.types";

export interface DocumentReaderProps {
  doc: DocContent | null;
  view: ReaderView;
  onView: (v: ReaderView) => void;
  onStar: () => void;
  onTrash: () => void;
  onHistory: () => void;
  historyOpen?: boolean;
  trashed?: boolean;
  onRestore: () => void;
  onPurge: () => void;
  trashBusy?: TrashAction | null;
  /** A relative link to another `.md` file in the vault was clicked. */
  onOpenDoc?: (path: string) => void;
}

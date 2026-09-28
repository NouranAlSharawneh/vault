import type { DocMeta } from "@shared/types";
import type { ReaderView, TrashAction } from "../../main.types";

export interface ReaderToolbarProps {
  doc: DocMeta | null;
  view: ReaderView;
  onView: (v: ReaderView) => void;
  onStar: () => void;
  onTrash: () => void;
  onHistory: () => void;
  historyOpen?: boolean;
  /** Set when the doc lives in `.trash/`: swaps the actions for Restore / Delete forever. */
  trashed?: boolean;
  onRestore: () => void;
  onPurge: () => void;
  /** The trash action in flight: its button spins, and none of them take another click. */
  trashBusy?: TrashAction | null;
}

import type { DocContent } from "@shared/types";
import type { ReaderView, TrashAction } from "../../main.types";

export interface DocumentReaderProps {
  doc: DocContent | null;
  /** The last document shown, drawn dimmed while `doc` loads. */
  previous?: DocContent | null;
  /** Why the selected document couldn't be read. */
  error?: string | null;
  onRetry?: () => void;
  /** Nothing in the list at all, so there is nothing to select either. */
  listEmpty?: boolean;
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
  onOpenDoc?: (path: string, hash?: string) => void;
  /** A section to scroll to once that document is showing. */
  anchor?: { path: string; id: string } | null;
  onAnchorShown?: () => void;
}

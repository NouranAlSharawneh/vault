import type { StoredDraft } from "@shared/types";

export interface EditorBannersProps {
  /** The document went to the trash while it was open here. */
  gone: boolean;
  onClose: () => void;
  /** Unsaved text older than the file, offered rather than put back. */
  staleDraft: StoredDraft | null;
  onStaleDraft: (restore: boolean) => void;
}

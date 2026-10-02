import { Button } from "@/components/ui";
import type { EditorBannersProps } from "./editor-banners.types";

const BANNER =
  "flex items-center gap-3 border-b border-line bg-warn/15 px-5 py-1.5 text-xs text-ink-2";

/** What changed under the document since it was opened here, and what to do about it. */
export function EditorBanners({ gone, onClose, staleDraft, onStaleDraft }: EditorBannersProps) {
  return (
    <>
      {/* Trashed from the main window while open here: said, so a save that brings it
          back is a choice rather than a surprise. */}
      {gone && (
        <div className={BANNER} role="status">
          This document was moved to the trash. Saving here puts it back.
          <Button variant="link" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
      {/* Older than the file: the file changed since (a pull, another editor). Offered,
          not put back — put back, the next save overwrote the newer file unannounced. */}
      {staleDraft && (
        <div className={BANNER} role="status">
          Unsaved text from {new Date(staleDraft.at).toLocaleString()} is older than this file.
          <Button variant="link" className="ml-auto" onClick={() => onStaleDraft(true)}>
            Restore it
          </Button>
          <Button variant="link" onClick={() => onStaleDraft(false)}>
            Discard
          </Button>
        </div>
      )}
    </>
  );
}

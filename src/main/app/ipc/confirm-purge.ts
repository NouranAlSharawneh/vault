import { dialog } from "electron";
import type { TrashedDoc } from "@shared/types";

/**
 * The one confirmation the app was missing.
 *
 * Emptying the trash and deleting a document forever are the only two acts in Vault that
 * cannot be undone — everything else is a commit, and a commit can be walked back. They
 * were also the only two that happened on a single click, while Reset Vault, which
 * destroys nothing on disk, asked first.
 *
 * It lives in main rather than the renderer so both entry points — the reader's toolbar
 * and Settings — are covered by one check that no call site can skip.
 */
export async function confirmPurge(
  path: string | undefined,
  trashed: TrashedDoc[],
): Promise<boolean> {
  const one = path ? trashed.find((t) => t.path === path) : undefined;
  const count = path ? 1 : trashed.length;
  if (!count) return true;
  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: [path ? "Delete forever" : "Empty trash", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: one ? `Delete “${one.meta.title}” forever?` : `Empty the trash?`,
    detail: one
      ? "The file and any images only it used are removed from the vault for good. This is the one thing in Vault you cannot undo."
      : `${count} ${count === 1 ? "document" : "documents"} and any images only they used are removed from the vault for good. This is the one thing in Vault you cannot undo.`,
  });
  return response === 0;
}

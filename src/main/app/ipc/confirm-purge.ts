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
  const IRREVERSIBLE = "This is the one thing in Vault you cannot undo.";
  if (path) {
    // The title is only for the wording — a path the listing does not know about is
    // still a delete, and must not be described as emptying the whole trash.
    const title = trashed.find((t) => t.path === path)?.meta.title;

    return ask({
      button: "Delete forever",
      message: title ? `Delete “${title}” forever?` : "Delete this document forever?",
      detail: `The file and any images only it used are removed from the vault for good. ${IRREVERSIBLE}`,
    });
  }
  if (!trashed.length) return true;
  const n = trashed.length;

  return ask({
    button: "Empty trash",
    message: "Empty the trash?",
    detail: `${n} ${n === 1 ? "document" : "documents"} and any images only they used are removed from the vault for good. ${IRREVERSIBLE}`,
  });
}

async function ask(opts: { button: string; message: string; detail: string }): Promise<boolean> {
  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: [opts.button, "Cancel"],
    // Cancel is both the default and what Escape does: the safe answer is the easy one.
    defaultId: 1,
    cancelId: 1,
    message: opts.message,
    detail: opts.detail,
  });

  return response === 0;
}

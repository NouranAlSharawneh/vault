import { rmSync } from "node:fs";
import { app, BrowserWindow, dialog } from "electron";
import { userDataDir } from "../../store/user-data-dir";
import { closeDocumentWindows, dialogParent } from "../../windows";
import { session } from "./session";

/** Sign out, forget the vault and the index cache, then relaunch at onboarding. The repo on disk is untouched. */
export async function resetApp(
  // From the menu there is no sender, so the question goes to whichever window is in front.
  parent = dialogParent(BrowserWindow.getFocusedWindow()),
): Promise<void> {
  const options: Electron.MessageBoxOptions = {
    type: "warning",
    buttons: ["Reset & relaunch", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: "Reset Marasca?",
    detail: resetDetail(session.vault?.status().ahead ?? 0),
  };
  const { response } = await (parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options));
  if (response !== 0) return;
  // Every document window gets its unsaved-changes question first. `exit` skips it, and
  // the parked drafts it would have fallen back on are in the folder about to go.
  if (!(await closeDocumentWindows())) return;
  await session.shutdown();
  rmSync(userDataDir(), { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

/** What a reset forgets, said before it happens rather than found out after. */
function resetDetail(unpushed: number): string {
  const waiting = unpushed
    ? ` ${unpushed} ${unpushed === 1 ? "commit hasn’t" : "commits haven’t"} reached GitHub yet; Marasca tries to push ${unpushed === 1 ? "it" : "them"} first.`
    : "";

  return (
    "Signs you out and forgets which vault is connected, along with this Mac’s settings: the capture shortcut, the push delay, remembered image folders and unsaved drafts." +
    waiting +
    " Your markdown files and git history stay exactly where they are."
  );
}

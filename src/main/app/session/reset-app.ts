import { rmSync } from "node:fs";
import { app, BrowserWindow, dialog } from "electron";
import { userDataDir } from "../../store/user-data-dir";
import { dialogParent } from "../../windows";
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
    detail:
      "Signs you out and forgets which vault is connected. Your markdown files and git history stay exactly where they are.",
  };
  const { response } = await (parent
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options));
  if (response !== 0) return;
  await session.closeVault();
  rmSync(userDataDir(), { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

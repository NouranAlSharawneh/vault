import { app, dialog } from "electron";
import { rmSync } from "node:fs";
import { userDataDir } from "../../store/user-data-dir";
import { session } from "./session";

/** Sign out, forget the vault and the index cache, then relaunch at onboarding. The repo on disk is untouched. */
export async function resetApp(): Promise<void> {
  const { response } = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Reset & relaunch", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: "Reset Vault?",
    detail:
      "Signs you out and forgets which vault is connected. Your markdown files and git history stay exactly where they are.",
  });
  if (response !== 0) return;
  await session.closeVault();
  rmSync(userDataDir(), { recursive: true, force: true });
  app.relaunch();
  app.exit(0);
}

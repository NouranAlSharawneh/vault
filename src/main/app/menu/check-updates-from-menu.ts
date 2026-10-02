import { BrowserWindow, dialog, shell } from "electron";
import type { UpdateCheck, UpdateInstall } from "@shared/types";
import { NetworkError } from "../../network/axios";
import { installUpdate, updateInstallState } from "../updates/update-install";
import { refreshUpdateStatus } from "../updates/update-watch";

/**
 * What the dialog says for each answer. `install` when this copy can replace itself with
 * the new version, `url` (the download page) when there is something newer either way.
 */
export function updateMessage(
  r: UpdateCheck,
  install: UpdateInstall = { phase: "ready" },
): { message: string; detail: string; url?: string; install?: string } {
  if (r.status === "available")
    return install.phase === "manual"
      ? {
          message: `Marasca ${r.latest} is available`,
          detail: `You have ${r.current}. ${install.reason} The download page has the new version and what changed.`,
          url: r.url,
        }
      : {
          message: `Marasca ${r.latest} is available`,
          detail: `You have ${r.current}. Marasca downloads it, quits and reopens on the new version.`,
          url: r.url,
          install: r.latest,
        };
  if (r.status === "up-to-date")
    return { message: "Marasca is up to date", detail: `${r.current} is the newest version.` };

  return { message: "No releases to compare with", detail: `You have Marasca ${r.current}.` };
}

/**
 * Marasca ▸ Check for Updates…, where every Mac app keeps it. The same check as Settings,
 * answered in a dialog so it works from any window, or none.
 */
export async function checkForUpdatesFromMenu(): Promise<void> {
  const parent = BrowserWindow.getFocusedWindow() ?? undefined;
  // An editor it was asked from may have closed for the update by the time it fails.
  const show = (o: Electron.MessageBoxOptions) =>
    parent && !parent.isDestroyed() ? dialog.showMessageBox(parent, o) : dialog.showMessageBox(o);
  let answer;
  try {
    // The same check the watch makes, so the gear's dot agrees with the dialog.
    answer = updateMessage(await refreshUpdateStatus(), await updateInstallState());
  } catch (e) {
    const limited = e instanceof NetworkError && e.status === 403;
    await show({
      type: "warning",
      message: "Couldn't check for updates",
      detail: limited
        ? "GitHub is limiting requests right now. Try again in a few minutes."
        : "Marasca couldn't reach GitHub. Check the connection and try again.",
    });

    return;
  }
  const { response } = await show({
    type: "info",
    message: answer.message,
    detail: answer.detail,
    buttons: answer.install
      ? ["Update and Restart", "Later"]
      : answer.url
        ? ["Download", "Later"]
        : ["OK"],
    defaultId: 0,
    cancelId: answer.url ? 1 : 0,
  });
  if (!answer.url || response !== 0) return;
  if (!answer.install) {
    await shell.openExternal(answer.url);

    return;
  }
  try {
    // Progress is on the Dock icon and in Settings; this resolves as Marasca quits.
    await installUpdate(answer.install);
  } catch (e) {
    const { response: open } = await show({
      type: "warning",
      message: "Couldn't update Marasca",
      detail: e instanceof Error ? e.message : String(e),
      buttons: ["Open Download Page", "Close"],
      defaultId: 0,
      cancelId: 1,
    });
    if (open === 0) await shell.openExternal(answer.url);
  }
}

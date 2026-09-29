import { app, BrowserWindow, dialog, shell } from "electron";
import type { UpdateCheck } from "@shared/types";
import { APP_REPO } from "../../data/menu.data";
import { NetworkError } from "../../network/axios";
import { checkForUpdates } from "../../services/updates/check-for-updates";

/** What the dialog says for each answer; `download` when there is something to fetch. */
export function updateMessage(r: UpdateCheck): { message: string; detail: string; url?: string } {
  if (r.status === "available")
    return {
      message: `Marasca ${r.latest} is available`,
      detail: `You have ${r.current}. The download page has the new version and what changed.`,
      url: r.url,
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
  const show = (o: Electron.MessageBoxOptions) =>
    parent ? dialog.showMessageBox(parent, o) : dialog.showMessageBox(o);
  let answer;
  try {
    answer = updateMessage(await checkForUpdates(APP_REPO, app.getVersion()));
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
    buttons: answer.url ? ["Download", "Later"] : ["OK"],
    defaultId: 0,
    cancelId: answer.url ? 1 : 0,
  });
  if (answer.url && response === 0) await shell.openExternal(answer.url);
}

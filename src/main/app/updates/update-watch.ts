import { app } from "electron";
import { UPDATE_CHECK_EVERY_MS, UPDATE_FIRST_CHECK_MS } from "@shared/constants";
import type { UpdateCheck } from "@shared/types";
import { APP_REPO } from "../../data/menu.data";
import { checkForUpdates } from "../../services/updates/check-for-updates";
import { broadcast } from "../../windows/broadcast";

/** The last answer from GitHub Releases, whoever asked: the watch, Settings, the menu. */
let latest: UpdateCheck | null = null;
let timers: { first?: ReturnType<typeof setTimeout>; every?: ReturnType<typeof setInterval> } = {};

/** What is known about updates right now; null until the first check has answered. */
export function updateStatus(): UpdateCheck | null {
  return latest;
}

/**
 * Ask GitHub, remember the answer and tell every window when it changed — the gear in the
 * library wears a dot while a newer version waits. Throws as the check does, so Settings
 * and the menu can say why it couldn't ask.
 */
export async function refreshUpdateStatus(): Promise<UpdateCheck> {
  const answer = await checkForUpdates(APP_REPO, app.getVersion());
  const changed =
    answer.status !== latest?.status ||
    ("latest" in answer ? answer.latest : null) !==
      (latest && "latest" in latest ? latest.latest : null);
  latest = answer;
  if (changed) broadcast("app:updateStatus", answer);

  return answer;
}

/**
 * A quiet check shortly after launch and every few hours after, so a new version is
 * noticed without anyone opening Settings. Failures say nothing: offline or rate limited,
 * the dot simply doesn't appear, and the next round tries again.
 */
export function watchForUpdates(): void {
  stopWatchingForUpdates();
  const quietly = () => void refreshUpdateStatus().catch(() => undefined);
  timers = {
    first: setTimeout(quietly, UPDATE_FIRST_CHECK_MS),
    every: setInterval(quietly, UPDATE_CHECK_EVERY_MS),
  };
}

export function stopWatchingForUpdates(): void {
  clearTimeout(timers.first);
  clearInterval(timers.every);
  timers = {};
}

/** For tests: forget the last answer. */
export function resetUpdateStatus(): void {
  latest = null;
}

import { powerMonitor } from "electron";
import { session } from "./session";
import { createSyncNudge } from "./sync-nudge";

const retry = createSyncNudge(() => session.vault?.nudge());

/** Something says the network may be back: retry what is waiting, once the burst settles. */
export function nudgeSync(): void {
  retry.nudge();
}

/**
 * The Mac waking or being unlocked is when a laptop gets its network back; the renderer
 * reports the browser's own "online" through `sync:nudge`. Without these a push that
 * failed on a train waited out its back-off, up to five minutes, after the Wi-Fi returned.
 */
export function watchForReconnect(): () => void {
  powerMonitor.on("resume", nudgeSync);
  powerMonitor.on("unlock-screen", nudgeSync);

  return () => {
    powerMonitor.removeListener("resume", nudgeSync);
    powerMonitor.removeListener("unlock-screen", nudgeSync);
    retry.cancel();
  };
}

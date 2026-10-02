import { SYNC_NUDGE_DEBOUNCE_MS } from "@shared/constants";
import { fire } from "../../lib/fire";

/**
 * One retry for a burst of reasons. Waking the Mac, unlocking it and the Wi-Fi coming
 * back usually arrive within a second of each other; each used to be its own push and
 * pull — or, before this, none of them was, and a push that failed offline waited out its
 * back-off long after the network was back.
 */
export function createSyncNudge(
  run: () => Promise<void> | undefined,
  delay = SYNC_NUDGE_DEBOUNCE_MS,
): { nudge: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    nudge: () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const done = run();
        if (done) fire(done, "retrying sync");
      }, delay);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

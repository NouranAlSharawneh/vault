import { PUSH_FAILURE_MESSAGE } from "@/data/sync.data";
import { plural } from "@/helpers";
import type { SyncStatus } from "@shared/types";

export type FirstPushLine = { tone: "busy" | "ok" | "warn"; text: string };

/** Where the first push stands, in the words the Done screen shows. */
export function firstPushLine(sync: SyncStatus | null, remote: string): FirstPushLine {
  if (!sync || sync.remote !== remote) return { tone: "busy", text: "Checking GitHub…" };
  if (sync.failure && sync.failure !== "offline")
    return { tone: "warn", text: PUSH_FAILURE_MESSAGE[sync.failure] };
  if (sync.state === "offline" || sync.failure === "offline")
    return { tone: "warn", text: "Offline — the first push goes as soon as you're back online." };
  if (sync.state === "pushing") return { tone: "busy", text: `Pushing to ${remote}…` };
  if (sync.ahead > 0)
    return { tone: "busy", text: `${plural(sync.ahead, "commit")} waiting to push to ${remote}…` };

  return sync.lastPushAt
    ? { tone: "ok", text: `Pushed — ${remote} has everything.` }
    : { tone: "ok", text: `Up to date with ${remote}.` };
}

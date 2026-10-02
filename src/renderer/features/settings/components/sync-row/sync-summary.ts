import { relativeTime } from "@shared/helpers";
import type { SyncStatus } from "@shared/types";

/** "3m ago", "just now", "on 2 Sep": a list's short times, as part of a sentence. */
function ago(at: number, now: number): string {
  const t = relativeTime(at, now);
  if (t === "just now") return t;

  return /^\d+[mhd]$/.test(t) ? `${t} ago` : `on ${t}`;
}

/** "Pushed 3m ago · pulled just now", and when the next try is, if one is waiting. */
export function syncSummary(sync: SyncStatus | null, now: number): string {
  if (!sync) return "Checking…";
  const pushed = sync.lastPushAt ? `pushed ${ago(sync.lastPushAt, now)}` : null;
  const pulled = sync.lastPullAt ? `pulled ${ago(sync.lastPullAt, now)}` : null;
  const parts = [pushed, pulled].filter(Boolean) as string[];
  const since = parts.length
    ? parts.join(" · ").replace(/^./, (c) => c.toUpperCase())
    : "Nothing pushed or pulled since Marasca opened";
  const retry =
    sync.nextRetryAt && sync.nextRetryAt > now
      ? ` · trying again at ${new Date(sync.nextRetryAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";

  return since + retry;
}

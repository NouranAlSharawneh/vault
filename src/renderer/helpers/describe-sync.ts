import { PULL_FAILURE_MESSAGE, PUSH_FAILURE_MESSAGE } from "@/data/sync.data";
import type { PullResult, SyncStatus } from "@shared/types";
import { plural } from "./plural";

/** What a pull asked for by hand did. It used to finish in silence, whatever happened. */
export function describePull({ pulled, conflicts, failure }: PullResult): string {
  if (failure) return PULL_FAILURE_MESSAGE[failure];
  const base =
    pulled > 0
      ? `Pulled ${plural(pulled, "change")} from GitHub`
      : "Already up to date with GitHub";

  return conflicts.length ? `${base} · ${plural(conflicts.length, "document")} to review` : base;
}

/**
 * After a push asked for by hand. The badge changes colour either way, but a colour is
 * easy to miss; the action you asked for should answer.
 */
export function describePush(waiting: number, { state, failure, ahead }: SyncStatus): string {
  if (failure) return PUSH_FAILURE_MESSAGE[failure];
  if (state === "offline") return PUSH_FAILURE_MESSAGE.offline;
  if (state === "pushing") return "Already pushing to GitHub";
  if (ahead > 0) return `${plural(ahead, "commit")} still waiting to push`;

  return waiting > 0
    ? `Pushed ${plural(waiting, "commit")} to GitHub`
    : "Nothing to push — GitHub is up to date";
}

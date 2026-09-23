import { useCallback } from "react";
import {
  FAILURE_PRESENTATION,
  SYNC_PRESENTATION,
  type SyncPresentation,
  UNKNOWN_PRESENTATION,
} from "@/data/sync.data";
import { plural } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { SyncStatus } from "@shared/types";

/** The failure's own wording when it has one; the state's otherwise. */
function present(sync: SyncStatus | null): { p: SyncPresentation; explained: boolean } {
  if (!sync) return { p: UNKNOWN_PRESENTATION, explained: false };
  const state = sync.state;
  // Only an error is explained by its failure; a retry in flight still reads "pushing…".
  const explained =
    state === "error" && sync.failure ? FAILURE_PRESENTATION[sync.failure] : undefined;

  return { p: explained ?? SYNC_PRESENTATION[state], explained: !!explained };
}

/**
 * Commits on GitHub this machine hasn't taken yet. Said beside the push state, because
 * "pushed" is true of what went up and says nothing about what is waiting to come down.
 */
function onGitHub(sync: SyncStatus | null): string {
  const behind = sync?.behind ?? 0;

  return behind > 0 ? ` · ${plural(behind, "change")} on GitHub` : "";
}

/** Current sync status + the one action the badge offers. */
export function useSync() {
  const sync = useApp((s) => s.sync);
  const config = useApp((s) => s.config);
  const pushNow = useCallback(() => api("sync:pushNow").catch(() => undefined), []);
  // Null is "not known yet": nothing to push and nothing to claim.
  const state = sync?.state ?? null;
  const { p, explained } = present(sync);

  return {
    sync,
    state,
    presentation: p,
    label: p.label(sync?.ahead ?? 0) + onGitHub(sync),
    // The raw error helps only when there is no plainer way to say what went wrong.
    detail: state === "error" && !explained ? (sync?.lastError ?? null) : null,
    canPush: state === "pending" || state === "offline" || state === "error",
    hasRemote: !!config?.remote,
    branch: config?.branch ?? "main",
    pushNow,
  };
}

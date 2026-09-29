import { useCallback } from "react";
import {
  FAILURE_PRESENTATION,
  SYNC_PRESENTATION,
  type SyncPresentation,
  UNKNOWN_PRESENTATION,
} from "@/data/sync.data";
import { describePull, describePush, plural } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { SyncStatus } from "@shared/types";

/** What clicking the badge does now, if anything. */
export interface SyncAction {
  label: string;
  run: () => void;
}

/** The failure's own wording when it has one; the state's otherwise. */
function present(sync: SyncStatus | null): { p: SyncPresentation; explained: boolean } {
  if (!sync) return { p: UNKNOWN_PRESENTATION, explained: false };
  const state = sync.state;
  // Only an error is explained by its failure; a retry in flight still reads "pushing…".
  const explained =
    state === "error" && sync.failure ? FAILURE_PRESENTATION[sync.failure] : undefined;
  // A failed pull is not a failed push, and "couldn't push" sent people to push again.
  if (!explained && state === "error" && sync.failedOp === "pull")
    return {
      p: { ...SYNC_PRESENTATION.error, label: () => "couldn’t pull — retry" },
      explained: false,
    };

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
  const method = useApp((s) => s.auth.method);
  const show = useToast((s) => s.show);
  // Every click answers: the result used to be thrown away, so pushing while offline
  // looked like nothing happened.
  const pushNow = useCallback(() => {
    const waiting = useApp.getState().sync?.ahead ?? 0;
    fire(
      api("sync:pushNow").then((after) => show(describePush(waiting, after))),
      "Couldn’t push",
    );
  }, [show]);
  const pull = useCallback(
    () =>
      fire(
        api("sync:pull").then((r) => show(describePull(r))),
        "Couldn’t pull",
      ),
    [show],
  );
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
    action: actionFor(sync, method, pushNow, pull),
    hasRemote: !!config?.remote,
    branch: config?.branch ?? "main",
  };
}

/**
 * The one thing a click can usefully do, or nothing — in which case the badge is text,
 * not a button that looks clickable and does nothing. Pushing again never fixes a dead
 * token or a read-only repo, so those go to the fix instead.
 */
function actionFor(
  sync: SyncStatus | null,
  method: string | null,
  push: () => void,
  pull: () => void,
): SyncAction | null {
  if (!sync) return null;
  const go = (route: string) => () => fire(api("window:openMain", route), "Couldn’t open that");
  if (sync.state === "error") {
    switch (sync.failure) {
      case "bad-credentials":
        return { label: "Sign in again", run: go("onboarding?signin") };
      case "no-permission":
        return method === "pat"
          ? { label: "Update the token", run: go("onboarding?signin") }
          : { label: "Connect a different repo", run: go("onboarding?connect") };
      case "not-found":
        return { label: "Connect a different repo", run: go("onboarding?connect") };
      case "blocked":
        return null;
      default:
        return sync.failedOp === "pull"
          ? { label: "Pull again", run: pull }
          : { label: "Push again", run: push };
    }
  }
  if (sync.state === "pending" || sync.state === "offline") return { label: "Push now", run: push };
  if (sync.state === "synced" && sync.behind > 0)
    return { label: `Pull ${plural(sync.behind, "change")} from GitHub`, run: pull };

  return null;
}

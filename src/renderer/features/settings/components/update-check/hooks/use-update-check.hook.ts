import { useCallback, useState } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { UpdateCheckState } from "../update-check.types";

/**
 * On demand, not on open: Settings shouldn't hit the network just because it was shown.
 * It starts from what the background check last heard, so the version the gear's dot
 * announced is offered for download straight away.
 */
export function useUpdateCheck() {
  const known = useApp((s) => s.update);
  const [state, setState] = useState<UpdateCheckState>(() =>
    known ? { phase: "done", result: known } : { phase: "idle" },
  );

  const check = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      setState({ phase: "done", result: await api("app:checkForUpdates") });
    } catch (e) {
      setState({ phase: "error", message: updateCheckFailure(errorMessage(e)) });
    }
  }, []);

  const download = useCallback((url: string) => api("app:openExternal", url), []);

  return { state, check, download };
}

/**
 * Why the check failed, in words that point at the fix. Every failure used to read as
 * "check your connection" — including GitHub's hourly limit on unsigned requests, which
 * no connection fixes.
 */
export function updateCheckFailure(message: string): string {
  if (/rate limit|\b403\b|\b429\b/i.test(message))
    return "GitHub is limiting requests right now. Try again in a while.";
  if (/\b5\d\d\b/.test(message)) return "GitHub isn’t answering properly. Try again shortly.";

  return "Couldn’t reach GitHub. Check your connection.";
}

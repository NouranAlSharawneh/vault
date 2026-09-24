import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { UpdateCheckState } from "../update-check.types";

/** On demand, not on open: Settings shouldn't hit the network just because it was shown. */
export function useUpdateCheck() {
  const [state, setState] = useState<UpdateCheckState>({ phase: "idle" });

  const check = useCallback(async () => {
    setState({ phase: "checking" });
    try {
      setState({ phase: "done", result: await api("app:checkForUpdates") });
    } catch {
      setState({ phase: "error", message: "Couldn’t reach GitHub. Check your connection." });
    }
  }, []);

  const download = useCallback((url: string) => api("app:openExternal", url), []);

  return { state, check, download };
}

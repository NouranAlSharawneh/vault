import { useCallback } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";

/** Current sync status + the one action the badge offers. */
export function useSync() {
  const sync = useApp((s) => s.sync);
  const config = useApp((s) => s.config);
  const pushNow = useCallback(() => api("sync:pushNow").catch(() => undefined), []);

  return { sync, hasRemote: !!config?.remote, branch: config?.branch ?? "main", pushNow };
}

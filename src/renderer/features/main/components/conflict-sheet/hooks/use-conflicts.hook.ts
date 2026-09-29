import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/helpers";
import { api } from "@/lib/api";
import type { ConflictPair } from "@shared/types";

/** The pairs still waiting on a decision, reloaded whenever one is settled. */
export function useConflicts(): {
  pairs: ConflictPair[] | null;
  error: string | null;
  reload: () => void;
} {
  const [pairs, setPairs] = useState<ConflictPair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    void api("conflicts:list")
      .then((p) => {
        if (!live) return;
        // A failed load is not for good: the next one that works clears it.
        setError(null);
        setPairs(p);
      })
      .catch((e: unknown) => live && setError(errorMessage(e)));

    return () => {
      live = false;
    };
  }, [round]);

  return { pairs, error, reload: useCallback(() => setRound((r) => r + 1), []) };
}

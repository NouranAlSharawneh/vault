import { useCallback, useEffect, useState } from "react";
import { DONE_SCREEN_DELAY_MS } from "@/constants";
import { errorMessage } from "@/helpers";
import { useApp } from "@/stores/app";

/** Tracks scan progress from the store and advances once the index is usable. */
export function useFirstScan(onDone: () => void) {
  const progress = useApp((s) => s.progress);
  const index = useApp((s) => s.index);
  const refreshIndex = useApp((s) => s.refreshIndex);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A failed read has to stop the bar, not leave it sitting at 10% with nothing to press.
  useEffect(() => {
    let cancelled = false;
    refreshIndex().catch((e: unknown) => !cancelled && setError(errorMessage(e)));

    return () => {
      cancelled = true;
    };
  }, [refreshIndex, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const finished =
    !error &&
    !!index &&
    (progress.phase === "done" ||
      progress.phase === "idle" ||
      (progress.phase === "bodies" && index.docs.length === 0));

  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(onDone, DONE_SCREEN_DELAY_MS);

    return () => clearTimeout(t);
  }, [finished, onDone]);

  const percent = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : finished
      ? 100
      : 10;

  return { index, percent, error, retry };
}

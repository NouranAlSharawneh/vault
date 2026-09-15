import { useEffect } from "react";
import { DONE_SCREEN_DELAY_MS } from "@/constants";
import { useApp } from "@/stores/app";

/** Tracks scan progress from the store and advances once the index is usable. */
export function useFirstScan(onDone: () => void) {
  const progress = useApp((s) => s.progress);
  const index = useApp((s) => s.index);
  const refreshIndex = useApp((s) => s.refreshIndex);

  useEffect(() => {
    void refreshIndex();
  }, [refreshIndex]);

  const finished =
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

  return { index, percent };
}

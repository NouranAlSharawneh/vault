import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ConflictPair } from "@shared/types";

export interface Versions {
  mine: string[];
  theirs: string[];
  /** Lines in one version that the other doesn't have anywhere, so they stand out. */
  onlyMine: Set<string>;
  onlyTheirs: Set<string>;
}

/**
 * Both bodies, side by side. An excerpt is not enough to choose between two versions of
 * the same note — the first paragraph is usually the part that didn't change.
 *
 * Which lines are marked is a presence check, not a diff: a line the other side doesn't
 * have anywhere. For two edits of one document that is exactly the signal, and it needs
 * no diff algorithm to be trustworthy.
 */
export function useVersions(pair: ConflictPair): { versions: Versions | null; failed: boolean } {
  const [v, setV] = useState<Versions | null>(null);
  const [failed, setFailed] = useState(false);
  const minePath = pair.mine.path;
  const theirsPath = pair.theirs.path;

  useEffect(() => {
    let live = true;
    void Promise.all([api("doc:read", minePath), api("doc:read", theirsPath)])
      .then(([a, b]) => {
        if (!live) return;
        const mine = a.body.split("\n");
        const theirs = b.body.split("\n");
        const mineSet = new Set(mine.map((l) => l.trim()));
        const theirsSet = new Set(theirs.map((l) => l.trim()));
        setV({
          mine,
          theirs,
          onlyMine: new Set(mine.filter((l) => l.trim() && !theirsSet.has(l.trim()))),
          onlyTheirs: new Set(theirs.filter((l) => l.trim() && !mineSet.has(l.trim()))),
        });
      })
      // Said, not papered over: falling back to the excerpt made a snippet look like the
      // whole version you were choosing.
      .catch(() => live && setFailed(true));

    return () => {
      live = false;
    };
  }, [minePath, theirsPath]);

  return { versions: v, failed };
}

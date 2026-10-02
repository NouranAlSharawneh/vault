import type { CommitInfo } from "@shared/types";

export type HistoryRow =
  | { kind: "commit"; commit: CommitInfo }
  /** Two or more metadata-only commits in a row, shown as one line until opened. */
  | { kind: "fold"; key: string; commits: CommitInfo[] };

/**
 * The commit list as it is shown: a run of commits that only touched the metadata — a
 * star on, a star off, a tag — folds into one line, since a document starred and unstarred
 * a few times had more rows about its star than about its text. A run holding the chosen
 * commit, or one that was opened, stays open; a lone metadata commit is never folded.
 */
export function foldCommits(
  commits: CommitInfo[],
  opened: ReadonlySet<string>,
  selected: string | null,
): HistoryRow[] {
  const rows: HistoryRow[] = [];
  let run: CommitInfo[] = [];
  const flush = () => {
    const key = run[0]?.sha ?? "";
    const keep = run.length < 2 || opened.has(key) || run.some((c) => c.sha === selected);
    if (keep) rows.push(...run.map((commit) => ({ kind: "commit" as const, commit })));
    else rows.push({ kind: "fold", key, commits: run });
    run = [];
  };
  for (const commit of commits) {
    if (commit.metaOnly) {
      run.push(commit);
      continue;
    }
    flush();
    rows.push({ kind: "commit", commit });
  }
  flush();

  return rows;
}

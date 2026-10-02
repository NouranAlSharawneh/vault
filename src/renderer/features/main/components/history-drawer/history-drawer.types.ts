import type { CommitInfo } from "@shared/types";

export interface HistoryDrawerProps {
  /** Repo-relative path of the document whose history this is. */
  path: string;
  onClose: () => void;
  /** A restore writes a new commit; the reader reloads from it. */
  onRestored: (path: string) => void;
}

export interface HistoryState {
  commits: CommitInfo[];
  selected: string | null;
  diff: string | null;
  /** Which commit `diff` belongs to, so a stale one is never shown. */
  diffFor: string | null;
  loading: boolean;
  restoring: boolean;
  /** The list of commits couldn't be read. */
  error: string | null;
  /** One commit's diff couldn't be read — said in the diff pane, the list stays usable. */
  diffError: string | null;
}

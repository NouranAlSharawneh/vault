import type { CommitInfo } from "@shared/types";

export interface CommitListProps {
  commits: CommitInfo[];
  selected: string | null;
  onSelect: (sha: string) => void;
  /** There may be older commits than the ones loaded. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
  /** The clock the relative times are worked out against. */
  now: number;
  takeFocus: boolean;
  onFocusTaken?: () => void;
}

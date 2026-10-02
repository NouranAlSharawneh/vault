import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, ListRow } from "@/components/ui";
import { plural } from "@/helpers";
import { fire } from "@/lib/api";
import { relativeTime } from "@shared/helpers";
import type { CommitInfo } from "@shared/types";
import { foldCommits } from "../../helpers/fold-commits";
import { useDrawerFocus } from "../../hooks/use-drawer-focus.hook";
import type { CommitListProps } from "./commit-list.types";

/** "+12 −3" for a commit, or nothing when it changed no lines (a move, say). */
function Stat({ commit }: { commit: CommitInfo }) {
  const added = commit.added ?? 0;
  const removed = commit.removed ?? 0;
  if (!added && !removed) return null;

  return (
    <span
      className="shrink-0 font-mono text-2xs leading-none tabular-nums"
      aria-label={`${added} added, ${removed} removed`}
    >
      <span className="text-ok-2">+{added}</span> <span className="text-cherry">−{removed}</span>
    </span>
  );
}

/**
 * The commits, newest first, with what each did to the text; runs of metadata-only
 * commits folded to one line; and, when the list goes back further than it has loaded,
 * a way to load the rest.
 */
export function CommitList({
  commits,
  selected,
  onSelect,
  hasMore,
  loadingMore,
  onLoadMore,
  now,
  takeFocus,
  onFocusTaken,
}: CommitListProps) {
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => foldCommits(commits, opened, selected), [commits, opened, selected]);
  // The arrows step through the commits on screen, not the ones folded away.
  const shown = useMemo(() => rows.flatMap((r) => (r.kind === "commit" ? [r.commit] : [])), [rows]);
  const { list, onKeyDown } = useDrawerFocus(shown, selected, onSelect, takeFocus, onFocusTaken);

  return (
    // The rows carry their own 2px margin, so this is the other 2px of an even 4px above
    // the first commit and below the last one.
    <ul
      ref={list}
      aria-label="Commits"
      onKeyDown={onKeyDown}
      className="max-h-56 shrink-0 overflow-y-auto px-2 py-0.5"
    >
      {rows.map((row) =>
        row.kind === "fold" ? (
          <li key={`fold:${row.key}`}>
            <ListRow
              tabIndex={-1}
              className="text-ink-4"
              onClick={() => setOpened((s) => new Set(s).add(row.key))}
              title="Show them"
            >
              <ChevronRight size={12} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate leading-none">
                {plural(row.commits.length, "metadata change")}
              </span>
              <span className="ml-auto shrink-0 font-mono text-2xs leading-none">
                {relativeTime(row.commits[0].date, now)}
              </span>
            </ListRow>
          </li>
        ) : (
          <li key={row.commit.sha}>
            <ListRow
              data-sha={row.commit.sha}
              // One Tab stop: the chosen commit. The arrows move between them.
              tabIndex={row.commit.sha === selected ? 0 : -1}
              selected={row.commit.sha === selected}
              onClick={() => onSelect(row.commit.sha)}
            >
              <span className="min-w-0 flex-1 truncate leading-none">{row.commit.message}</span>
              <Stat commit={row.commit} />
              <span
                className="ml-2 shrink-0 font-mono text-2xs leading-none text-ink-4"
                title={new Date(row.commit.date).toLocaleString()}
              >
                {relativeTime(row.commit.date, now)}
              </span>
            </ListRow>
          </li>
        ),
      )}
      {hasMore && (
        <li className="px-2 py-1.5">
          <Button variant="link" disabled={loadingMore} onClick={() => fire(onLoadMore())}>
            {loadingMore ? "Loading older commits…" : "Load older commits"}
          </Button>
        </li>
      )}
    </ul>
  );
}

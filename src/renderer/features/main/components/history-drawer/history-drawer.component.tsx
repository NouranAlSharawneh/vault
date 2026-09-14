import { RotateCcw, X } from "lucide-react";
import { Button, Empty, ListRow, SectionLabel } from "@/components/ui";
import { cx, diffStat, parseUnifiedDiff } from "@/helpers";
import type { DiffHunk } from "@shared/types";
import { useDocHistory } from "./hooks/use-doc-history.hook";
import type { HistoryDrawerProps } from "./history-drawer.types";

/** ⌘Y: every commit that touched this document, what each changed, and a way back. */
export function HistoryDrawer({ path, onClose, onRestored }: HistoryDrawerProps) {
  const h = useDocHistory(path, onRestored);
  const hunks = h.diff ? parseUnifiedDiff(h.diff) : [];
  const stat = diffStat(hunks);
  const newest = h.commits[0]?.sha;

  return (
    <aside
      data-testid="history-drawer"
      // Its own inset card, like the reader beside it — wide enough for a diff, capped
      // so it never crushes the document.
      className="mr-2 mb-2 flex w-110 max-w-[42vw] shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-paper-2 shadow-pop"
    >
      {/* No document title here — it is already on the document this sits beside. */}
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-4 pt-1">
        <SectionLabel>History</SectionLabel>
        <Button
          variant="ghost"
          size="sm"
          className="w-7 px-0"
          onClick={onClose}
          aria-label="close history"
        >
          <X size={13} />
        </Button>
      </header>

      {h.loading ? (
        <div className="p-4 text-xs text-ink-4">Reading history…</div>
      ) : h.error ? (
        <div className="p-4 text-xs text-cherry-3">{h.error}</div>
      ) : !h.commits.length ? (
        <Empty title="No history yet" hint="This document hasn't been committed." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* The rows carry their own 4px margin; padding on top of that is what made the
              label feel detached from the list. Only the bottom edge needs a little. */}
          <ul className="max-h-56 shrink-0 overflow-y-auto px-2 pb-1.5">
            {h.commits.map((c) => (
              <li key={c.sha}>
                <ListRow selected={c.sha === h.selected} onClick={() => h.select(c.sha)}>
                  <span className="min-w-0 flex-1 truncate">{c.message}</span>
                  <span className="ml-auto shrink-0 font-mono text-2xs text-ink-4">
                    {c.relative}
                  </span>
                </ListRow>
              </li>
            ))}
          </ul>

          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-y border-line px-4">
            <span className="font-mono text-2xs text-ink-4">
              {h.selected?.slice(0, 7)}
              {hunks.length > 0 && (
                <>
                  {" · "}
                  <span className="text-ok">+{stat.added}</span>{" "}
                  <span className="text-cherry-3">−{stat.removed}</span>
                </>
              )}
            </span>
            {h.selected && h.selected !== newest && (
              <Button
                variant="outline"
                size="sm"
                loading={h.restoring}
                onClick={() => void h.restore()}
                title="Bring this version back as a new commit"
              >
                <RotateCcw size={11} /> Restore this version
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {h.diff === null ? (
              <div className="p-4 text-xs text-ink-4">Loading diff…</div>
            ) : !hunks.length ? (
              <div className="p-4 text-xs text-ink-4">
                This commit didn't change the document's contents.
              </div>
            ) : (
              hunks.map((hunk, i) => (
                <div key={i}>
                  <div className="bg-paper-3/60 px-4 py-1 font-mono text-2xs text-ink-4">
                    {hunk.heading || lineRange(hunk)}
                  </div>
                  <pre className="m-0 rounded-none border-0 bg-transparent p-0 font-mono text-xs leading-relaxed">
                    {hunk.lines.map((line, j) => (
                      <div
                        key={j}
                        className={cx(
                          "flex gap-3 px-4",
                          line.kind === "added" && "bg-ok/10 text-ink",
                          line.kind === "removed" && "bg-cherry/10 text-ink",
                          line.kind === "context" && "text-ink-3",
                        )}
                      >
                        <span className="w-8 shrink-0 text-right text-ink-4 select-none">
                          {line.newLine ?? line.oldLine}
                        </span>
                        <span className="w-3 shrink-0 text-ink-4 select-none">
                          {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
                        </span>
                        <span className="whitespace-pre-wrap">{line.text || " "}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

/** "Lines 1–18" when git gives no section heading for the hunk. */
function lineRange(hunk: DiffHunk): string {
  const numbers = hunk.lines
    .map((l) => l.newLine ?? l.oldLine)
    .filter((n): n is number => n !== null);
  if (!numbers.length) return "";
  const from = Math.min(...numbers);
  const to = Math.max(...numbers);
  return from === to ? `Line ${from}` : `Lines ${from}–${to}`;
}

import { RotateCcw } from "lucide-react";
import { Button, DialogHeader, Empty, Segmented } from "@/components/ui";
import { cx, diffStat, parseUnifiedDiff } from "@/helpers";
import { fire } from "@/lib/api";
import type { DiffHunk } from "@shared/types";
import { useNow } from "../../hooks/use-now.hook";
import { CommitList } from "./components/commit-list/commit-list.component";
import type { HistoryDrawerProps } from "./history-drawer.types";
import { useDocHistory } from "./hooks/use-doc-history.hook";

const DIFF_MODES = [
  { value: "commit", label: "This commit" },
  { value: "since", label: "Since then" },
] as const;

/** ⌘Y: every commit that touched this document, what each changed, and a way back. */
export function HistoryDrawer({
  path,
  onClose,
  onRestored,
  takeFocus = false,
  onFocusTaken,
}: HistoryDrawerProps) {
  const h = useDocHistory(path, onRestored);
  // Worked out here against a clock that moves: said once by main, "just now" stayed.
  const now = useNow();
  const hunks = h.diff ? parseUnifiedDiff(h.diff) : [];
  const stat = diffStat(hunks);
  const newest = h.newest;

  return (
    <aside
      data-testid="history-drawer"
      aria-label="Document history"
      // Its own inset card, like the reader beside it — wide enough for a diff, capped
      // at two fifths of the window so it never crushes the document.
      className="mr-2 mb-2 flex w-110 max-w-2/5 shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-paper-2 shadow-pop"
    >
      {/* No document title here — it is already on the document this sits beside.
          Every line of text in this drawer sits in a fixed-height band, and every one of
          them carries `leading-none`: a line box reserves room for descenders, so text
          that happens to have none — an all-caps label, a commit sha — floats above the
          band's middle and leans away from the icon or button beside it. */}
      <DialogHeader title="History" closeLabel="close history" onClose={onClose} />

      {h.loading ? (
        <div className="p-4 text-xs text-ink-4">Reading history…</div>
      ) : h.error ? (
        <div className="p-4 text-xs text-cherry">{h.error}</div>
      ) : !h.commits.length ? (
        <Empty title="No history yet" hint="This document hasn't been committed." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <CommitList
            commits={h.commits}
            selected={h.selected}
            onSelect={h.select}
            hasMore={h.hasMore}
            loadingMore={h.loadingMore}
            onLoadMore={h.loadMore}
            now={now}
            takeFocus={takeFocus}
            onFocusTaken={onFocusTaken}
          />

          <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-y border-line px-4">
            <span className="font-mono text-2xs leading-none text-ink-4">
              {h.selected?.slice(0, 7)}
              {hunks.length > 0 && (
                <>
                  {" · "}
                  <span className="text-ok-2">+{stat.added}</span>{" "}
                  <span className="text-cherry">−{stat.removed}</span>
                </>
              )}
            </span>
            {h.selected && h.selected !== newest && (
              <Button
                variant="outline"
                size="sm"
                loading={h.restoring}
                onClick={() => fire(h.restore())}
                tooltip="Brings it back as a new commit — nothing is rewritten"
              >
                <RotateCcw size={12} /> Restore this version
              </Button>
            )}
          </div>
          {/* A commit's own change, or everything since it — "what have I done to this
              since?" took reading every commit after it, one at a time. */}
          {h.selected && h.selected !== newest && (
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-4">
              <Segmented
                label="Show"
                options={DIFF_MODES}
                value={h.compare ? "since" : "commit"}
                onChange={(mode) => h.setCompare(mode === "since")}
              />
            </div>
          )}

          <div
            tabIndex={0}
            aria-label={h.compare ? "What changed since this version" : "What this commit changed"}
            className="min-h-0 flex-1 overflow-auto -outline-offset-2"
          >
            {h.diffError ? (
              <div className="p-4 text-xs text-cherry">
                Couldn’t show what {h.compare ? "changed since" : "this commit changed"}:{" "}
                {h.diffError}
              </div>
            ) : h.diff === null ? (
              <div className="p-4 text-xs text-ink-4">Loading diff…</div>
            ) : !hunks.length ? (
              <div className="p-4 text-xs text-ink-4">
                {h.compare
                  ? "Nothing has changed since this version."
                  : "This commit didn't change the document's contents."}
              </div>
            ) : (
              hunks.map((hunk, i) => (
                <div key={i}>
                  <div className="flex h-5.5 items-center bg-paper-3/60 px-4 font-mono text-2xs leading-none text-ink-4">
                    {/* git's own heading is the nearest line that looks like a function —
                        in a document that's "flowchart LR" as often as a section. Only a
                        markdown heading says where you are. */}
                    {hunk.heading?.startsWith("#") ? hunk.heading : lineRange(hunk)}
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

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { FindBarProps } from "./find-bar.types";

/** "3 of 12", "No matches", or nothing before anything is typed. */
function tally(query: string, count: number, current: number): string {
  if (!query) return "";

  return count ? `${current} of ${count}` : "No matches";
}

/**
 * The reader's ⌘F bar: what to look for, where you are among the matches, and the way
 * through them — Enter for the next, ⇧Enter for the previous, Esc to put it away.
 */
export function FindBar({
  query,
  onQuery,
  count,
  current,
  onNext,
  onPrevious,
  onClose,
}: FindBarProps) {
  return (
    <div
      role="search"
      aria-label="Find in this document"
      data-find-bar
      className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-paper-2 px-4"
    >
      <input
        className="input input-sm w-56"
        aria-label="Find in this document"
        placeholder="Find in this document"
        value={query}
        autoFocus
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onPrevious();
            else onNext();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <span role="status" className="min-w-16 text-xs text-ink-4 tabular-nums">
        {tally(query, count, current)}
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!count}
          onClick={onPrevious}
          aria-label="Previous match"
          tooltip="Previous"
          tooltipKeys="⇧↵"
        >
          <ChevronUp size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!count}
          onClick={onNext}
          aria-label="Next match"
          tooltip="Next"
          tooltipKeys="↵"
        >
          <ChevronDown size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close find"
          tooltip="Close"
          tooltipKeys="Esc"
          tooltipAlign="end"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

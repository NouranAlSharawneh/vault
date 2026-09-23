import { GitMerge } from "lucide-react";
import { Button, Dot, Spinner } from "@/components/ui";
import { SYNC_PRESENTATION } from "@/data/sync.data";
import { cx } from "@/helpers";
import { fire } from "@/lib/api";
import { useSync } from "./hooks/use-sync.hook";
import type { SyncBadgeProps } from "./sync-badge.types";

/** `● main · pushed` — the only place green/amber appear. Click to push now. */
export function SyncBadge({ className, onReviewConflicts }: SyncBadgeProps) {
  const { sync, hasRemote, branch, pushNow } = useSync();
  // Two versions of a document is not about the remote — they are two files sitting in
  // the vault, still there if the remote was disconnected after they arrived — and not
  // about pushing either, so it is said separately from the push state rather than
  // instead of it.
  const waiting = onReviewConflicts ? (sync?.conflicts ?? 0) : 0;
  if (!hasRemote && !waiting) {
    return (
      <span
        className={cx("flex items-center gap-1.5 text-xs text-ink-4", className)}
        title="Local-only vault"
      >
        <Dot tone="bg-line-2" size={6} /> local
      </span>
    );
  }
  const state = sync?.state ?? "synced";
  const p = SYNC_PRESENTATION[state];
  const canPush = state === "pending" || state === "offline" || state === "error";
  // The badge has room for the start of the error; the whole of it goes in the tooltip,
  // wrapped, since a git refusal is often longer than the window is wide.
  const lastError = state === "error" ? sync?.lastError : null;
  const tooltip = lastError ? (
    <span className="block max-w-80 whitespace-normal">
      {lastError}
      <span className="mt-1 block text-overlay-ink-3">Click to push again</span>
    </span>
  ) : canPush ? (
    "Push now"
  ) : undefined;

  return (
    <span className={cx("flex items-center gap-1", className)}>
      {hasRemote && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 font-normal"
          onClick={canPush ? () => fire(pushNow()) : undefined}
          tooltip={tooltip}
          aria-label={`sync: ${p.label(sync?.ahead ?? 0)}${lastError ? ` — ${lastError}` : ""}`}
        >
          {p.busy ? <Spinner className="text-warn" /> : <Dot tone={p.dot} size={6} />}
          <span className="font-mono">{branch}</span>
          <span className="text-ink-4">·</span>
          <span>{p.label(sync?.ahead ?? 0)}</span>
          {lastError && <span className="max-w-80 truncate text-ink-4">— {lastError}</span>}
        </Button>
      )}
      {waiting > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 font-normal text-cherry-2"
          onClick={onReviewConflicts}
          tooltip="Two versions of the same document"
          aria-label={`review ${waiting} conflicting document(s)`}
        >
          <GitMerge size={11} />
          {waiting === 1 ? "1 to review" : `${waiting} to review`}
        </Button>
      )}
    </span>
  );
}

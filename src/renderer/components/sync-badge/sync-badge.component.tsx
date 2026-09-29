import { GitMerge } from "lucide-react";
import { Button, Dot, Spinner } from "@/components/ui";
import { cx } from "@/helpers";
import { useSync } from "./hooks/use-sync.hook";
import type { SyncBadgeProps } from "./sync-badge.types";

/** `● main · pushed` — the only place green/amber appear. Click to push now. */
export function SyncBadge({ className, onReviewConflicts }: SyncBadgeProps) {
  const { sync, presentation: p, label, detail, action, hasRemote, branch } = useSync();
  // Two versions of a document is not about the remote — they are two files sitting in
  // the vault, still there if the remote was disconnected after they arrived — and not
  // about pushing either, so it is said separately from the push state rather than
  // instead of it.
  const waiting = onReviewConflicts ? (sync?.conflicts ?? 0) : 0;
  if (!hasRemote && !waiting) {
    return (
      <span
        className={cx("flex items-center gap-1.5 px-2 text-xs text-ink-4", className)}
        title="Local-only vault"
      >
        <Dot tone="bg-line-2" size={6} /> local
      </span>
    );
  }
  // The error goes in the tooltip, wrapped, since a git refusal is often longer than the
  // window is wide; inline, it pushed the New button off the edge of the title bar.
  const tooltip =
    detail || action ? (
      <span className="block max-w-80 whitespace-normal">
        {detail}
        {action && (
          <span className={cx("block", detail && "mt-1 text-overlay-ink-3")}>{action.label}</span>
        )}
      </span>
    ) : undefined;
  const face = (
    <>
      {p.busy ? <Spinner className="text-warn" /> : <Dot tone={p.dot} size={6} />}
      <span className="max-w-24 truncate font-mono">{branch}</span>
      <span className="text-ink-4">·</span>
      <span className="truncate">{label}</span>
    </>
  );

  return (
    <span className={cx("flex min-w-0 items-center gap-1", className)}>
      {hasRemote &&
        (action ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 gap-1.5 font-normal no-drag"
            onClick={action.run}
            tooltip={tooltip}
            aria-label={`Sync: ${label}${detail ? ` — ${detail}` : ""}. ${action.label}`}
          >
            {face}
          </Button>
        ) : (
          // Nothing to do: said as text, not a button that looks clickable and does nothing.
          <span
            className="flex min-w-0 items-center gap-1.5 px-2 text-xs text-ink-3"
            title={detail ?? undefined}
            role="status"
          >
            {face}
          </span>
        ))}
      {waiting > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 font-normal text-cherry-2 no-drag"
          onClick={onReviewConflicts}
          tooltip="Two versions of the same document"
          aria-label={`review ${waiting} conflicting document(s)`}
        >
          <GitMerge size={12} />
          {waiting === 1 ? "1 to review" : `${waiting} to review`}
        </Button>
      )}
    </span>
  );
}

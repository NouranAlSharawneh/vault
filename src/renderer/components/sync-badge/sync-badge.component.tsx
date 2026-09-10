import { Button, Spinner } from "@/components/ui";
import { SYNC_PRESENTATION } from "@/data/sync.data";
import { cx } from "@/helpers";
import { useSync } from "./hooks/use-sync.hook";
import type { SyncBadgeProps } from "./sync-badge.types";

/** `● main · pushed` — the only place green/amber appear. Click to push now. */
export function SyncBadge({ className }: SyncBadgeProps) {
  const { sync, hasRemote, branch, pushNow } = useSync();
  if (!hasRemote) {
    return (
      <span
        className={cx("flex items-center gap-1.5 text-xs text-ink-4", className)}
        title="Local-only vault"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-line-2" /> local
      </span>
    );
  }
  const state = sync?.state ?? "synced";
  const p = SYNC_PRESENTATION[state];
  const canPush = state === "pending" || state === "offline" || state === "error";
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cx("gap-1.5 font-normal", className)}
      onClick={canPush ? () => void pushNow() : undefined}
      title={sync?.lastError ?? (canPush ? "Push now" : undefined)}
      aria-label={`sync: ${p.label(sync?.ahead ?? 0)}`}
    >
      {p.busy ? (
        <Spinner className="text-warn" />
      ) : (
        <span className={cx("h-1.5 w-1.5 rounded-full", p.dot)} />
      )}
      <span className="font-mono">{branch}</span>
      <span className="text-ink-4">·</span>
      <span>{p.label(sync?.ahead ?? 0)}</span>
    </Button>
  );
}

import { Check, Copy } from "lucide-react";
import { Button, Dot, Spinner } from "@/components/ui";
import { GIT_ACTION_LABELS } from "@/data/git.data";
import { cx, describeGit } from "@/helpers";
import type { GitTone } from "@/helpers/describe-git.types";
import type { GitNoticeProps } from "./git-notice.types";
import { useGitActions } from "./hooks/use-git-actions.hook";

const DOT_TONE: Record<Exclude<GitTone, "wait">, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  alert: "bg-cherry",
};

/**
 * Whether git works, said once and quietly when it does, and as a card with the fix when it
 * doesn't. Every save is a commit, so this is the one prerequisite Marasca has.
 */
export function GitNotice({ hideWhenReady, className }: GitNoticeProps) {
  const { status, busy, copied, run } = useGitActions();
  if (!status || (hideWhenReady && status.state === "ready")) return null;
  const copy = describeGit(status);

  if (copy.tone === "ok") {
    return (
      <div className={cx("flex items-center gap-2 text-xs text-ink-3", className)} role="status">
        <Dot tone={DOT_TONE.ok} size={6} />
        {copy.title}
        {copy.body && <span className="text-ink-4">· {copy.body}</span>}
      </div>
    );
  }

  return (
    <div
      role="status"
      className={cx(
        "flex gap-3 rounded-md border p-3.5 text-left",
        copy.tone === "alert" ? "border-cherry-tint-2 bg-cherry-tint" : "border-line bg-paper-2",
        className,
      )}
    >
      <span className="mt-1 shrink-0">
        {copy.tone === "wait" ? (
          <Spinner className="text-warn-2" />
        ) : (
          <Dot tone={DOT_TONE[copy.tone]} size={8} />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-md font-medium text-ink">{copy.title}</div>
        {copy.body && <div className="text-sm text-ink-3">{copy.body}</div>}
        {copy.command && (
          <div className="flex items-center gap-2 overflow-x-auto rounded-sm bg-paper-3 py-1 pr-1 pl-2.5 font-mono text-xs text-ink-2">
            <span className="whitespace-nowrap">{copy.command}</span>
            <Button size="sm" className="ml-auto" onClick={() => run("copy")}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : GIT_ACTION_LABELS.copy}
            </Button>
          </div>
        )}
        {(copy.primary || copy.secondary.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
            {copy.primary && (
              <Button
                variant="primary"
                size="sm"
                loading={busy === copy.primary}
                onClick={() => run(copy.primary!)}
              >
                {GIT_ACTION_LABELS[copy.primary]}
              </Button>
            )}
            {copy.secondary.map((action) => (
              <Button
                key={action}
                variant="subtle"
                className="text-xs underline decoration-line-2 underline-offset-4"
                loading={busy === action}
                onClick={() => run(action)}
              >
                {GIT_ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

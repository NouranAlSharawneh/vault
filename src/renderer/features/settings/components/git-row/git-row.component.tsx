import { useGitActions } from "@/components/git-notice/hooks/use-git-actions.hook";
import { Button, Dot, PathText } from "@/components/ui";
import { GIT_ACTION_LABELS } from "@/data/git.data";
import { describeGit, shortPath } from "@/helpers";
import { SettingRow } from "../setting-row/setting-row.component";

/**
 * Which git Marasca runs, and a way to point it at another. Detection covers Apple's
 * tools, Homebrew, MacPorts and Nix; this is for everything else.
 */
export function GitRow() {
  const { status, busy, run } = useGitActions();
  if (!status) return null;
  const copy = describeGit(status);
  const ready = status.state === "ready";
  const custom = ready ? status.source === "custom" : status.state === "custom-invalid";

  return (
    <SettingRow
      label="Git"
      description={
        ready ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Dot tone="bg-ok" size={6} />
            <span className="shrink-0">
              {status.version} · {copy.body}
            </span>
            <PathText path={shortPath(status.binary)} className="text-ink-4" />
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Dot tone="bg-cherry" size={6} /> {copy.title}
          </span>
        )
      }
    >
      {custom ? (
        <Button
          variant="outline"
          loading={busy === "useDetected"}
          onClick={() => run("useDetected")}
        >
          {GIT_ACTION_LABELS.useDetected}
        </Button>
      ) : (
        !ready && (
          <Button variant="outline" loading={busy === "recheck"} onClick={() => run("recheck")}>
            {GIT_ACTION_LABELS.recheck}
          </Button>
        )
      )}
      <Button variant="outline" loading={busy === "choose"} onClick={() => run("choose")}>
        Choose…
      </Button>
    </SettingRow>
  );
}

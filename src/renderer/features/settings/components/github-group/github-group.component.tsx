import { ChevronDown } from "lucide-react";
import { Button, Dot, SettingGroup } from "@/components/ui";
import { PUSH_DEBOUNCE_LABELS } from "@/data/settings.data";
import { describeToken } from "@/helpers";
import { fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import { SettingRow } from "../setting-row/setting-row.component";
import type { GitHubGroupProps } from "./github-group.types";

/** The account, the repo it pushes to, and how soon after a save. */
export function GitHubGroup({ s, config }: GitHubGroupProps) {
  const sync = useApp((st) => st.sync);
  const user = s.auth.user;
  const signedIn = s.auth.status === "signed-in";
  const expired = s.auth.status === "expired";
  const delayError = s.errorFor("pushDebounceMs");
  // The dot says what the badge says, not always "fine".
  const repoTone =
    !signedIn || sync?.state === "error"
      ? "bg-cherry"
      : sync?.state === "pending" || sync?.state === "pushing"
        ? "bg-warn"
        : sync?.state === "offline"
          ? "bg-ink-4"
          : "bg-ok";

  return (
    <SettingGroup title="GitHub">
      {user ? (
        <SettingRow
          leading={
            <img src={user.avatarUrl} alt="" className="size-7 shrink-0 rounded-full bg-paper-3" />
          }
          label={`@${user.login}`}
          description={
            expired ? (
              <span className="text-cherry">
                GitHub signed you out. Nothing is pushed until you sign in again.
              </span>
            ) : (
              (describeToken(s.token, undefined, s.auth.method) ?? user.name ?? "Signed in")
            )
          }
        >
          {expired && (
            <Button variant="primary" onClick={() => (window.location.hash = "onboarding?signin")}>
              Sign in again
            </Button>
          )}
          <Button
            variant="outline"
            loading={s.busy === "signOut"}
            onClick={() => fire(s.signOut())}
          >
            Sign out
          </Button>
        </SettingRow>
      ) : (
        <SettingRow label="Account" description="Sign in to push your vault to GitHub.">
          <Button variant="primary" onClick={() => (window.location.hash = "onboarding?signin")}>
            Sign in
          </Button>
        </SettingRow>
      )}

      {config.remote ? (
        <SettingRow
          label="Repository"
          description={
            <span className="flex items-center gap-1.5">
              <Dot tone={repoTone} size={6} />
              <span className="truncate font-mono">{config.remote}</span>
              <span className="shrink-0">· {config.branch}</span>
            </span>
          }
        />
      ) : (
        <SettingRow
          label="Repository"
          description={
            signedIn
              ? "Local only. Pick a repo to push to, or create a new private one."
              : "Local only — nothing is pushed."
          }
        >
          {signedIn && (
            <Button variant="primary" onClick={() => (window.location.hash = "onboarding?connect")}>
              Connect a repo
            </Button>
          )}
        </SettingRow>
      )}

      {config.remote && (
        <SettingRow
          label="Push after saving"
          description={
            delayError ? (
              <span className="text-cherry">{delayError}</span>
            ) : (
              "How long to wait after each commit."
            )
          }
        >
          {/* The native control drew its own chevron hard against the right edge, in a
              different weight from every other control here; ours matches the source
              picker's. It sizes to its longest option rather than a fixed width, which left
              a wide empty gap before the chevron. */}
          <div className="relative">
            <select
              className="input input-sm w-auto cursor-pointer appearance-none pr-7"
              value={config.pushDebounceMs}
              disabled={s.busy === "pushDebounceMs"}
              onChange={(e) => fire(s.update({ pushDebounceMs: Number(e.target.value) }))}
              aria-label="Push after saving"
            >
              {PUSH_DEBOUNCE_LABELS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-4"
            />
          </div>
        </SettingRow>
      )}
    </SettingGroup>
  );
}

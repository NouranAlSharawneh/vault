import { Button } from "@/components/ui";
import { describeToken, tokenExpiryWarning } from "@/helpers";
import { fire } from "@/lib/api";
import type { GitHubGroupProps } from "../github-group/github-group.types";
import { SettingRow } from "../setting-row/setting-row.component";

const signInAgain = () => (window.location.hash = "onboarding?signin");

/** Who is signed in, what their token is like, and a way out — or in. */
export function AccountRow({ s }: Pick<GitHubGroupProps, "s">) {
  const user = s.auth.user;
  const expired = s.auth.status === "expired";
  // Said a week ahead, while there is time: pushes used to just stop the day it lapsed.
  const expiring = expired ? null : tokenExpiryWarning(s.token);

  if (!user)
    return (
      <SettingRow label="Account" description="Sign in to push your vault to GitHub.">
        <Button variant="primary" onClick={signInAgain}>
          Sign in
        </Button>
      </SettingRow>
    );

  return (
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
        ) : expiring ? (
          <span className="text-warn-2">{expiring}</span>
        ) : (
          (describeToken(s.token, undefined, s.auth.method) ?? user.name ?? "Signed in")
        )
      }
    >
      {(expired || expiring) && (
        <Button variant="primary" onClick={signInAgain}>
          {expired ? "Sign in again" : "Paste a new token"}
        </Button>
      )}
      <Button variant="outline" loading={s.busy === "signOut"} onClick={() => fire(s.signOut())}>
        Sign out
      </Button>
    </SettingRow>
  );
}

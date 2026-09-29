import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { cx } from "@/helpers";
import { api, fire } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { NoWriteAccessBannerProps } from "./no-write-access-banner.types";

/**
 * Shown when GitHub accepts the token but refuses the push. Signing in again fixes
 * nothing here and retrying never will, so it offers the two things that do: pick a repo
 * you can write to, or go and get access to this one.
 */
export function NoWriteAccessBanner({ className }: NoWriteAccessBannerProps) {
  const sync = useApp((s) => s.sync);
  const remote = useApp((s) => s.config?.remote);
  // A pasted token that can't write is nearly always the token, not the account: made
  // without Contents · Read and write. Neither button below fixes that; a new token does.
  const pat = useApp((s) => s.auth.method === "pat");
  if (!remote || sync?.state !== "error" || sync.failure !== "no-permission") return null;
  if (pat)
    return (
      <div
        className={cx(
          "flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs text-ink-2",
          className,
        )}
        role="status"
      >
        <AlertTriangle size={12} className="text-warn-2" />
        Your token can’t write to {remote}. Give it Contents · Read and write, or paste a new one.
        <Button
          variant="link"
          className="ml-auto"
          onClick={() => fire(api("window:openMain", "onboarding?signin"), "Couldn’t open sign-in")}
        >
          Update token
        </Button>
      </div>
    );

  return (
    <div
      className={cx("flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs text-ink-2", className)}
      role="status"
    >
      <AlertTriangle size={12} className="text-warn-2" />
      You don’t have write access to {remote}. Documents still save on this Mac.
      <Button
        variant="link"
        className="ml-auto"
        onClick={() =>
          fire(api("window:openMain", "onboarding?connect"), "Couldn’t open repo setup")
        }
      >
        Connect a different repo
      </Button>
      <Button
        variant="link"
        onClick={() => fire(api("github:openInBrowser", remote), "Couldn’t open GitHub")}
      >
        Open on GitHub
      </Button>
    </div>
  );
}

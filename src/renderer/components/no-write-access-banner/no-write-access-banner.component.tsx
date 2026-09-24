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
  if (!remote || sync?.state !== "error" || sync.failure !== "no-permission") return null;

  return (
    <div
      className={cx("flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs text-ink-2", className)}
      role="status"
    >
      <AlertTriangle size={12} className="text-warn" />
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

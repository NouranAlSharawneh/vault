import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { cx } from "@/helpers";
import { api } from "@/lib/api";
import { useApp } from "@/stores/app";
import type { AuthExpiredBannerProps } from "./auth-expired-banner.types";

/** Shown on every window when GitHub returns 401. Saves keep working locally; pushes wait. */
export function AuthExpiredBanner({ className }: AuthExpiredBannerProps) {
  const auth = useApp((s) => s.auth);
  const config = useApp((s) => s.config);
  if (auth.status !== "expired" || !config?.remote) return null;
  return (
    <div
      className={cx("flex items-center gap-2 bg-warn/15 px-4 py-1.5 text-xs text-ink-2", className)}
      role="status"
    >
      <AlertTriangle size={12} className="text-warn" />
      GitHub signed you out — documents still save locally; pushes resume once you sign in again.
      <Button
        variant="link"
        className="ml-auto"
        onClick={() => api("window:openMain", "onboarding?signin")}
      >
        Sign in again
      </Button>
    </div>
  );
}

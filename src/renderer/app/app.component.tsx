import { useEffect } from "react";
import { AuthExpiredBanner } from "@/components/auth-expired-banner/auth-expired-banner.component";
import { Logo } from "@/components/ui";
import { ROUTES } from "@/routes";
import { subscribeToMain, useApp } from "@/stores/app";
import { useRoute } from "./hooks/use-route.hook";

export function App() {
  const route = useRoute();
  const ready = useApp((s) => s.ready);
  const boot = useApp((s) => s.boot);

  useEffect(() => {
    subscribeToMain();
    boot().catch((e: unknown) => console.error("boot failed", e));
  }, [boot]);

  if (!ready) {
    // Every call in `boot` has its own fallback, so this is a brief flash, not a state
    // the window can get stuck in. It must stay transparent for the capture sheet.
    return (
      <div className="flex h-full items-center justify-center bg-transparent text-line-2">
        <Logo size={28} />
      </div>
    );
  }
  const Route = ROUTES[route];
  if (route === "capture") {
    return (
      <div className="h-full p-3">
        <Route />
      </div>
    );
  }
  if (route === "onboarding") return <Route />;
  return (
    <div className="flex h-full flex-col">
      <AuthExpiredBanner />
      <div className="min-h-0 flex-1">
        <Route />
      </div>
    </div>
  );
}

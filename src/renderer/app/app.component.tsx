import { useEffect } from "react";
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
    void boot();
  }, [boot]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-line-2">
        <Logo size={28} />
      </div>
    );
  }
  const Route = ROUTES[route];
  return <Route />;
}

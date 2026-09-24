import { useEffect } from "react";
import { Logo, type ToastPlacement, Toasts } from "@/components/ui";
import { ROUTES } from "@/routes";
import { subscribeToMain, useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import type { AppRoute } from "@shared/types";
import type { RouteViewProps } from "./app.types";
import { useRoute } from "./hooks/use-route.hook";

/**
 * Where each window's toasts sit. The editor's save bar and the capture sheet's buttons
 * are what you reach for after a failure, so the toasts keep clear of them.
 */
const TOAST_PLACEMENT: Record<AppRoute, ToastPlacement> = {
  main: "bottom",
  onboarding: "bottom",
  settings: "bottom",
  editor: "above-footer",
  capture: "top",
};

export function App() {
  const route = useRoute();
  const ready = useApp((s) => s.ready);
  const boot = useApp((s) => s.boot);
  const toasts = useToast((s) => s.toasts);
  const announced = useToast((s) => s.announced);
  const dismissToast = useToast((s) => s.dismiss);

  useEffect(() => {
    subscribeToMain();
    boot().catch((e: unknown) => console.error("boot failed", e));
  }, [boot]);

  // One host for every route, outside the switch. It used to live in Main alone, so a
  // failure `fire` reported anywhere else — onboarding, settings, the editor and capture
  // windows — went to a store nothing was drawing.
  return (
    <div className="relative h-full">
      {ready ? <RouteView route={route} /> : <Booting />}
      <Toasts
        toasts={toasts}
        announced={announced}
        onDismiss={dismissToast}
        placement={TOAST_PLACEMENT[route]}
        onDark={route === "capture"}
      />
    </div>
  );
}

function Booting() {
  // Every call in `boot` has its own fallback, so this is a brief flash, not a state
  // the window can get stuck in. It must stay transparent for the capture sheet.
  return (
    <div className="flex h-full items-center justify-center bg-transparent text-line-2">
      <Logo size={28} />
    </div>
  );
}

function RouteView({ route }: RouteViewProps) {
  const Route = ROUTES[route];
  // Edge to edge: the sheet's window is transparent and macOS shadows whatever is opaque,
  // so the panel itself is the window's shape. Padding here left room for a CSS shadow
  // that the window then cut off, and macOS shadowed the cut.
  if (route === "capture") return <Route />;
  if (route === "onboarding") return <Route />;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Route />
      </div>
    </div>
  );
}

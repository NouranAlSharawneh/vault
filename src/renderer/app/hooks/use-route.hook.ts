import { useEffect, useState } from "react";
import { on } from "@/lib/api";
import { APP_ROUTES } from "@shared/constants";
import type { AppRoute } from "@shared/types";

function routeFromHash(): AppRoute {
  const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];

  return (APP_ROUTES as readonly string[]).includes(h) ? (h as AppRoute) : "main";
}

/** Hash-based routing; main can also push a `navigate` event. */
export function useRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(routeFromHash);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    const off = on("navigate", (r) => {
      window.location.hash = r;
    });

    return () => {
      window.removeEventListener("hashchange", onHash);
      off();
    };
  }, []);

  return route;
}

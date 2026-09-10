import { useCallback, useEffect, useState } from "react";
import type { WebFlowStatus } from "@shared/types";
import { errorMessage } from "@/helpers";
import { api, on } from "@/lib/api";

interface WebFlowState {
  status: WebFlowStatus;
  message?: string;
}

/** Kicks off the browser-based flow on mount and mirrors main's progress events. */
export function useWebFlow() {
  const [state, setState] = useState<WebFlowState>({ status: "waiting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api("auth:webStart").catch(
      (e: unknown) => !cancelled && setState({ status: "error", message: errorMessage(e) }),
    );
    const off = on("auth:webStatus", (s) => setState(s));
    return () => {
      cancelled = true;
      off();
      void api("auth:webCancel");
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "waiting" });
    setAttempt((n) => n + 1);
  }, []);

  const failed =
    state.status === "error" || state.status === "timeout" || state.status === "cancelled";
  return { ...state, failed, retry };
}

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/helpers";
import { api, fireQuietly, on } from "@/lib/api";
import type { WebFlowStatus } from "@shared/types";
import type { WebFlowState } from "../web-flow.types";

const FAILED_STATUSES: WebFlowStatus[] = ["error", "timeout", "cancelled", "denied"];

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
      fireQuietly(api("auth:webCancel"), "cancelling the sign-in");
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "waiting" });
    setAttempt((n) => n + 1);
  }, []);

  const failed = FAILED_STATUSES.includes(state.status);

  return { ...state, failed, retry };
}

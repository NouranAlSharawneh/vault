import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/helpers";
import { api, fireQuietly, on } from "@/lib/api";
import type { DeviceCodeSession, DevicePollStatus } from "@shared/types";

/** Starts the OAuth device flow on mount, tracks poll status and the expiry countdown. */
export function useDeviceFlow() {
  const [session, setSession] = useState<DeviceCodeSession | null>(null);
  const [status, setStatus] = useState<DevicePollStatus>("pending");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Each attempt asks main for a fresh code; state is only touched in the promise callbacks.
  useEffect(() => {
    let cancelled = false;
    api("auth:deviceStart")
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setSecondsLeft(s.expiresIn);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    const off = on("auth:deviceStatus", ({ status }) => setStatus(status));

    return () => {
      cancelled = true;
      off();
      fireQuietly(api("auth:deviceCancel"), "cancelling the device flow");
    };
  }, [attempt]);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setSecondsLeft((l) => Math.max(0, l - 1)), 1000);

    return () => clearInterval(t);
  }, [session]);

  const restart = useCallback(() => {
    setError(null);
    setStatus("pending");
    setSession(null);
    setAttempt((n) => n + 1);
  }, []);

  const terminal = status === "expired" || status === "denied" || status === "error";

  return { session, status, error, secondsLeft, terminal, restart };
}

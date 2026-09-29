import { useEffect, useState } from "react";

/**
 * The time, updated every `everyMs`. Relative times are worked out against it, so a
 * window left open doesn't keep saying "just now" about something from this morning.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);

    return () => clearInterval(t);
  }, [everyMs]);

  return now;
}

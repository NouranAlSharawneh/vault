import { useEffect, useState } from "react";
import { LOGO_HOP_FRAME_MS, LOGO_HOP_LOOPS } from "@shared/constants";
import type { LogoGrid, LogoRows } from "../logo.types";

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Steps through the hop frames `LOGO_HOP_LOOPS` times, then settles on the resting pose.
 * Returns undefined when there is no hop to play, so the caller draws its still.
 */
export function useHop(hop: LogoGrid["hop"]): LogoRows | undefined {
  const [frame, setFrame] = useState<number | null>(() => (hop && !reducedMotion() ? 0 : null));

  useEffect(() => {
    if (!hop || reducedMotion()) return;
    const total = hop.frames.length * LOGO_HOP_LOOPS;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= total) {
        window.clearInterval(id);
        setFrame(null);
      } else setFrame(i % hop.frames.length);
    }, LOGO_HOP_FRAME_MS);

    return () => window.clearInterval(id);
  }, [hop]);

  if (!hop) return undefined;

  return frame === null ? hop.rest : hop.frames[frame];
}

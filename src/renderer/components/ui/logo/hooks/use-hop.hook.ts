import { useEffect, useState } from "react";
import { LOGO_HOP_FRAME_MS } from "@shared/constants";
import type { LogoGrid, LogoRows } from "../logo.types";

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Loops the hop frames continuously, with no pause between bounces, for as long as the
 * logo is mounted. Under reduced motion it holds the resting pose instead. Returns
 * undefined when there is no hop to play, so the caller draws its still.
 */
export function useHop(hop: LogoGrid["hop"]): LogoRows | undefined {
  const [frame, setFrame] = useState<number | null>(() => (hop && !reducedMotion() ? 0 : null));

  useEffect(() => {
    if (!hop || reducedMotion()) return;
    const id = window.setInterval(
      () => setFrame((f) => ((f ?? 0) + 1) % hop.frames.length),
      LOGO_HOP_FRAME_MS,
    );

    return () => window.clearInterval(id);
  }, [hop]);

  if (!hop) return undefined;

  return frame === null ? hop.rest : hop.frames[frame];
}

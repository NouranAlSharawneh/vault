import { LOGO_16, LOGO_20 } from "@/data/logo.data";
import { pixelRuns } from "@/helpers";
import { LOGO_LARGE_MIN_PX } from "@shared/constants";
import { useHop } from "./hooks/use-hop.hook";
import type { LogoCell, LogoProps } from "./logo.types";

const BRAND_FILL: Record<LogoCell, string> = {
  L: "fill-cherry",
  R: "fill-cherry-3",
  S: "fill-cherry-2",
};

/** The pixel cherry. The 16×16 drawing below 32px, the 20×20 one from 32px up. */
export function Logo({ size = 28, tone = "brand", bounce = false, className }: LogoProps) {
  const grid = size < LOGO_LARGE_MIN_PX ? LOGO_16 : LOGO_20;
  const rows = useHop(bounce ? grid.hop : undefined) ?? grid.still;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label="Marasca"
    >
      {pixelRuns(rows).map((run) => (
        <rect
          key={`${run.x}.${run.y}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          className={tone === "brand" ? BRAND_FILL[run.cell as LogoCell] : "fill-current"}
        />
      ))}
    </svg>
  );
}

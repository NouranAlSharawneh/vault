import { WORDMARK_ROWS } from "@/data/logo.data";
import { pixelRuns } from "@/helpers";
import type { WordmarkProps } from "./wordmark.types";

const COLS = WORDMARK_ROWS[0].length;
const ROWS = WORDMARK_ROWS.length;

/** "marasca" in the 5×7 pixel font that goes with the logo. Draws in `currentColor`. */
export function Wordmark({ height = 24, className }: WordmarkProps) {
  return (
    <svg
      width={(height * COLS) / ROWS}
      height={height}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="Marasca"
    >
      {pixelRuns(WORDMARK_ROWS).map((run) => (
        <rect key={`${run.x}.${run.y}`} x={run.x} y={run.y} width={run.width} height={1} />
      ))}
    </svg>
  );
}

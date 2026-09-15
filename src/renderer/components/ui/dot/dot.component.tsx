import { cx } from "@/helpers";
import type { DotProps } from "./dot.types";

/**
 * The one small round status swatch: project colours, sync state, signed-in.
 * It was hand-rolled as `h-1.5 w-1.5 rounded-full` in four places while this sat unused.
 */
export function Dot({ color, tone, size = 8, className }: DotProps) {
  return (
    <span
      className={cx("inline-block shrink-0 rounded-full", tone, className)}
      style={{ width: size, height: size, ...(color ? { background: color } : null) }}
    />
  );
}

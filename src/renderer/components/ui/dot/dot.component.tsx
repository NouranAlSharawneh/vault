import { cx } from "@/helpers";
import type { DotProps } from "./dot.types";

/** Colour swatch used for projects and sync state. */
export function Dot({ color, size = 8, className }: DotProps) {
  return (
    <span
      className={cx("inline-block shrink-0 rounded-full", className)}
      style={{ width: size, height: size, background: color }}
    />
  );
}

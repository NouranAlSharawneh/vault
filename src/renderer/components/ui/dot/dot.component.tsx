import { cx } from "@/helpers";
import type { DotProps } from "./dot.types";

/**
 * The one small round status swatch: project colours, sync state, signed-in.
 * It was hand-rolled as `h-1.5 w-1.5 rounded-full` in four places while this sat unused.
 *
 * Decorative unless labelled. A labelled dot is the only place its meaning is said (the
 * list's "not pushed yet"), so it becomes an image with that name; an unlabelled one is
 * hidden, since a colour beside a word adds nothing a screen reader can say.
 */
export function Dot({ color, tone, size = 8, className, "aria-label": label }: DotProps) {
  return (
    <span
      className={cx("inline-block shrink-0 rounded-full", tone, className)}
      style={{ width: size, height: size, ...(color ? { background: color } : null) }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

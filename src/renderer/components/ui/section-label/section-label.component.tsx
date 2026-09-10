import { cx } from "@/helpers";
import type { SectionLabelProps } from "./section-label.types";

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cx("text-2xs font-semibold tracking-widest text-ink-4 uppercase", className)}>
      {children}
    </div>
  );
}

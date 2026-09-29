import { cx } from "@/helpers";
import type { SectionLabelProps } from "./section-label.types";

export function SectionLabel({
  children,
  className,
  as: Tag = "div",
  id,
  htmlFor,
}: SectionLabelProps) {
  return (
    <Tag
      id={id}
      htmlFor={Tag === "label" ? htmlFor : undefined}
      className={cx("block text-2xs font-semibold tracking-widest text-ink-4 uppercase", className)}
    >
      {children}
    </Tag>
  );
}

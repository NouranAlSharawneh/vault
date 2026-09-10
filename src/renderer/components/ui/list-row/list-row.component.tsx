import { cx } from "@/helpers";
import type { ListRowProps } from "./list-row.types";

const KIND_CLASS = {
  nav: "flex h-7 items-center gap-2 rounded-sm px-2 text-sm",
  item: "block border-b border-line/70 px-4 py-2.5",
  option: "flex items-center gap-2.5 px-3 py-2 text-sm",
} as const;

const SELECTED_CLASS = {
  nav: ["bg-paper-3 font-medium", "hover:bg-paper-3"],
  item: ["bg-paper-2", "hover:bg-paper-2/60"],
  option: ["bg-cherry-tint", "hover:bg-paper-2"],
} as const;

/** A full-width selectable row (sidebar entries, document list, pickers). */
export function ListRow({
  selected = false,
  kind = "nav",
  className,
  type = "button",
  ...rest
}: ListRowProps) {
  const [on, off] = SELECTED_CLASS[kind];
  return (
    <button
      type={type}
      aria-selected={selected}
      className={cx("w-full text-left", KIND_CLASS[kind], selected ? on : off, className)}
      {...rest}
    />
  );
}

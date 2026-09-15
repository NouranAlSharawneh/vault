import { cx } from "@/helpers";
import type { ListRowProps } from "./list-row.types";

const KIND_CLASS = {
  nav: "my-0.5 flex h-7 items-center gap-2 rounded-sm px-2 text-sm",
  item: "block border-b border-line/70 px-4 py-2.5",
  option: "flex items-center gap-2.5 px-3 py-2 text-sm",
  menu: "flex items-center gap-2 rounded-xs px-2 py-1 text-sm",
  palette: "flex items-start gap-3 px-4 py-2",
  rail: "my-0.5 flex h-8 w-8 items-center justify-center rounded-md transition-colors",
} as const;

const SELECTED_CLASS = {
  nav: ["bg-paper-3 font-medium", "hover:bg-paper-3"],
  item: ["bg-paper-2", "hover:bg-paper-2/60"],
  option: ["bg-cherry-tint", "hover:bg-paper-2"],
  menu: ["bg-cherry-tint text-cherry-2", "hover:bg-paper-2"],
  palette: ["bg-cherry/25 text-overlay-ink", "hover:bg-overlay-2"],
  rail: ["bg-paper-3 text-ink", "text-ink-3 hover:bg-paper-3"],
} as const;

const DARK_OFF = { menu: "text-overlay-ink-2 hover:bg-overlay-3" } as Partial<
  Record<ListRowProps["kind"] & string, string>
>;

/** A selectable row or slot (sidebar entries, lists, pickers, dropdowns, palette results). */
export function ListRow({
  selected = false,
  kind = "nav",
  dark,
  className,
  type = "button",
  ...rest
}: ListRowProps) {
  const [on, off] = SELECTED_CLASS[kind];
  const full = kind !== "rail";

  return (
    <button
      type={type}
      aria-selected={selected}
      className={cx(
        full && "w-full text-left",
        KIND_CLASS[kind],
        selected ? on : (dark && DARK_OFF[kind]) || off,
        className,
      )}
      {...rest}
    />
  );
}

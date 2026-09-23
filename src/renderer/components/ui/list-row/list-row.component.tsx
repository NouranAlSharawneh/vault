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
  item: ["bg-paper-2", "hover:bg-paper-2"],
  option: ["bg-cherry-tint", "hover:bg-paper-2"],
  menu: ["bg-cherry-tint text-cherry-2", "hover:bg-paper-2"],
  palette: ["bg-cherry/25 text-overlay-ink", "hover:bg-overlay-2"],
  rail: ["bg-paper-3 text-ink", "text-ink-3 hover:bg-paper-3"],
} as const;

const DARK_OFF = { menu: "text-overlay-ink-2 hover:bg-overlay-3" } as Partial<
  Record<ListRowProps["kind"] & string, string>
>;

/**
 * How each kind says it is the chosen one. A dropdown or palette row is an option of a
 * listbox whose focus stays in its input (the input points at it with
 * aria-activedescendant), so it is out of the Tab order. The repo picker's rows are a
 * pressed-or-not choice. Everything else — sidebar, rail, lists — marks the current one.
 * `aria-selected` on a plain button, which is what every kind used to get, means nothing.
 */
function selectionProps(kind: NonNullable<ListRowProps["kind"]>, selected: boolean) {
  if (kind === "menu" || kind === "palette")
    return { role: "option", "aria-selected": selected, tabIndex: -1 } as const;
  if (kind === "option") return { "aria-pressed": selected } as const;

  return { "aria-current": selected ? ("true" as const) : undefined };
}

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
      {...selectionProps(kind, selected)}
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

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

/**
 * default — quiet grey · primary — cherry fill · outline — bordered · ghost — icon-ish
 * link — inline cherry text · subtle — inline muted text · danger — bordered, cherry text
 */
export type ButtonVariant =
  "default" | "primary" | "outline" | "ghost" | "link" | "subtle" | "danger";
/** sm h-6 · md h-7 · lg h-9 for hero actions · icon 28×28 · icon-sm 24×24 (icon-only). */
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Hover label. Icon-only buttons should always carry one, alongside `aria-label`. */
  tooltip?: ReactNode;
  /** The button's shortcut, shown quieter inside the tooltip. */
  tooltipKeys?: string;
  /** Which way the tooltip opens. Default "bottom". */
  tooltipSide?: "top" | "bottom";
  /** Which edge of the button the tooltip lines up with. Default "center"; "end" near a
   *  panel's right edge, where a centred label would be clipped. */
  tooltipAlign?: "start" | "center" | "end";
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * default — quiet grey · primary — cherry fill · outline — bordered · ghost — icon-ish
 * link — inline cherry text · subtle — inline muted text · danger — bordered, cherry text
 */
export type ButtonVariant =
  "default" | "primary" | "outline" | "ghost" | "link" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Hover label. Icon-only buttons should always carry one, alongside `aria-label`. */
  tooltip?: ReactNode;
  /** The button's shortcut, shown quieter inside the tooltip. */
  tooltipKeys?: string;
  /** Which way the tooltip opens. Default "bottom". */
  tooltipSide?: "top" | "bottom";
}

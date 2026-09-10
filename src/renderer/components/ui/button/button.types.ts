import type { ButtonHTMLAttributes } from "react";

/**
 * default — quiet grey · primary — cherry fill · outline — bordered · ghost — icon-ish
 * link — inline cherry text · subtle — inline muted text
 */
export type ButtonVariant = "default" | "primary" | "outline" | "ghost" | "link" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

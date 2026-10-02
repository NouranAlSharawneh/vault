import type { ReactNode } from "react";

export interface EmptyProps {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  /** "error" when something failed rather than there being nothing: an alert, with a
   *  warning mark in place of the logo. */
  tone?: "neutral" | "error";
  /** Replaces the mark above the title. */
  icon?: ReactNode;
  /** Extra lines under the hint (a raw error, a path). */
  children?: ReactNode;
  className?: string;
}

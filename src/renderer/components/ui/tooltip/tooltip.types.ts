import type { ReactNode } from "react";

export interface TooltipProps {
  /** What the control does, in a word or two. Shortcuts belong here too. */
  label: ReactNode;
  /** The control's shortcut, set quieter beside the label. */
  keys?: string;
  /** Which way to open. Default "bottom"; use "top" when the control sits near the floor. */
  side?: "top" | "bottom";
  children: ReactNode;
  className?: string;
}

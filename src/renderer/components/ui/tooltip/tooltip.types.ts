import type { ReactNode } from "react";

export interface TooltipProps {
  /** What the control does, in a word or two. Shortcuts belong here too. */
  label: ReactNode;
  /** The control's shortcut, set quieter beside the label. */
  keys?: string;
  /** Which way to open. Default "bottom"; use "top" when the control sits near the floor. */
  side?: "top" | "bottom";
  /** Which edge of the control the label lines up with. Default "center". The window
   *  edge is handled by measuring; a panel that clips its overflow is not, so a control
   *  near a panel's right edge says "end". */
  align?: "start" | "center" | "end";
  children: ReactNode;
  className?: string;
}

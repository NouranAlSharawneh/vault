import type { ReactNode } from "react";

export interface KbdProps {
  children: ReactNode;
  /** On a dark surface that isn't itself inside `.dark`. */
  dark?: boolean;
  /** On a filled (primary) button: takes the button's own colour. */
  onFill?: boolean;
  className?: string;
}

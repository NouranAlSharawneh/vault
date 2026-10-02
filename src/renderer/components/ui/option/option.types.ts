import type { ReactNode } from "react";

export interface OptionProps {
  selected: boolean;
  onClick: () => void;
  badge?: string;
  children: ReactNode;
  /** Controls that belong to this choice (the new repo's name): drawn in the same card,
   *  but outside the radio itself, whose content assistive tech treats as plain text. */
  detail?: ReactNode;
}

import type { ReactNode } from "react";

export interface OptionProps {
  selected: boolean;
  onClick: () => void;
  badge?: string;
  children: ReactNode;
}

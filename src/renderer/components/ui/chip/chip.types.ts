import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  /** Tag styling (cherry tint) vs neutral. */
  tone?: "tag" | "neutral";
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  title?: string;
  className?: string;
}

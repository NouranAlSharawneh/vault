import type { ReactNode } from "react";

export interface ChipProps {
  children: ReactNode;
  /** Tag styling (cherry tint) vs neutral. */
  tone?: "tag" | "neutral";
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  /** Accessible name of the remove button, e.g. "Remove spec" — a bare "remove" says nothing about what goes. */
  removeLabel?: string;
  title?: string;
  /** On a dark surface: a clickable chip brightens its text there, not its fill. */
  dark?: boolean;
  className?: string;
}

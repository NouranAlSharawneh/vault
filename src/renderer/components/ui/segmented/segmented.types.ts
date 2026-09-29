import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown instead of the label when the set is `compact` and its container is narrow. */
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the set chooses between, for screen readers ("Reader view"). */
  label: string;
  /** Inside an `@container` narrower than `@md`, show each option's icon, not its label. */
  compact?: boolean;
  /** On a dark surface (the capture sheet). */
  dark?: boolean;
  className?: string;
}

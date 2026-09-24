import type { ReactNode } from "react";

export interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** Shown as a small badge after the label: how many items the row stands for. */
  count?: number;
  /** Sits before the label, e.g. the GitHub avatar. */
  leading?: ReactNode;
  /** A sub-row that belongs to the row above it (one remembered image folder). */
  nested?: boolean;
  /** The controls. Rows without one are allowed: the label then spans the row. */
  children?: ReactNode;
}

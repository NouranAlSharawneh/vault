import type { ReactNode } from "react";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial left-pane share (0–1). */
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  /** localStorage key; omit to not persist. */
  storageKey?: string;
  className?: string;
}

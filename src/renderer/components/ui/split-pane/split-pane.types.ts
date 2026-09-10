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
  /** `line` draws a hairline; `gap` is an invisible 8px gutter that only shows while dragging. */
  handle?: "line" | "gap";
  className?: string;
}

import type { ReactNode } from "react";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial left-pane share (0–1). */
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  /** The left pane never narrower than this, in pixels. */
  minPx?: number;
  /** …nor wider than this. */
  maxPx?: number;
  /** What the divider resizes, for a screen reader. */
  label?: string;
  /** localStorage key; omit to not persist. */
  storageKey?: string;
  /** `line` draws a hairline; `gap` is an invisible 8px gutter that only shows while dragging. */
  handle?: "line" | "gap";
  /** The right pane folded away, the left one full width — still mounted, so what it
   *  holds (an editor's cursor and undo history) survives the fold. */
  collapsed?: boolean;
  className?: string;
}

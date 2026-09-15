import type { ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** The capture sheet is a transparent window; a panel there must not paint a backdrop. */
  bare?: boolean;
}

export interface ErrorBoundaryState {
  error: Error | null;
}

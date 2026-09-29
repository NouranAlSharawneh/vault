import type { ReactNode } from "react";

export interface StepFooterProps {
  onBack?: () => void;
  /** The step's actions, primary last. */
  children?: ReactNode;
}

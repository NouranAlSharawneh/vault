import type { ReactNode } from "react";

export interface DialogShellProps {
  /** Announced to screen readers, and what the dialog is called in tests. */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** How far down the panel sits (`pt-16`). Default `pt-20`; the dim is the same for all. */
  backdropClassName?: string;
  /** Selector for what should hold focus when it opens. Defaults to the first control. */
  initialFocus?: string;
}

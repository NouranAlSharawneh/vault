import type { ReactNode } from "react";

export interface DialogShellProps {
  /** Announced to screen readers, and what the dialog is called in tests. */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Backdrop classes: where the panel sits, and how dark the screen behind it goes. */
  backdropClassName?: string;
  /** Selector for what should hold focus when it opens. Defaults to the first control. */
  initialFocus?: string;
}

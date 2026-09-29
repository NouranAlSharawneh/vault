import type { ReactNode } from "react";

export interface DialogHeaderProps {
  /** The dialog's name, as a section label. */
  title: ReactNode;
  /** Close control's accessible name ("close history"). Omit for a header with no close. */
  closeLabel?: string;
  onClose?: () => void;
  /** Anything that sits between the title and the close button. */
  children?: ReactNode;
  className?: string;
}

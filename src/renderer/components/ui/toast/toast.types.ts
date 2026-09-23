import type { Toast } from "@/stores/toast";

export interface ToastsProps {
  toasts: Toast[];
  /** The newest message, written into the always-present live region. */
  announced: Toast | null;
  onDismiss: (id: number) => void;
  /** Where the stack sits. Default "bottom". */
  side?: "top" | "bottom";
  /** Drawn over a dark surface (the capture sheet), where the usual ink pill disappears. */
  onDark?: boolean;
}

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
  onDark?: boolean;
}

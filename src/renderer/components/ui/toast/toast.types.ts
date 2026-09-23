import type { Toast } from "@/stores/toast";

/** `above-footer` clears the editor's save bar; `top` keeps the capture sheet's buttons free. */
export type ToastPlacement = "bottom" | "above-footer" | "top";

export interface ToastsProps {
  toasts: Toast[];
  /** The newest message, written into the always-present live region. */
  announced: Toast | null;
  onDismiss: (id: number) => void;
  /** Where the stack sits. Default "bottom". */
  placement?: ToastPlacement;
  /** Drawn over a dark surface (the capture sheet), where the usual ink pill disappears. */
  onDark?: boolean;
}

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
  onDark?: boolean;
}

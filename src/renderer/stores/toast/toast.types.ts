export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

export interface ToastState {
  /** Oldest first, at most `TOAST_MAX`. */
  toasts: Toast[];
  /** The newest toast, for the live region. Cleared when it goes, never rolled back to an
   *  older one, so a screen reader hears each message once. */
  announced: Toast | null;
  /** Show a message alongside any already up. Returns its id. */
  show: (message: string, action?: ToastAction) => number;
  /** Take one toast down, or every toast with no id. */
  dismiss: (id?: number) => void;
}

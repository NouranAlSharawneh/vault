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
  toast: Toast | null;
  /** Show a message (replacing any current one). Returns its id. */
  show: (message: string, action?: ToastAction) => number;
  dismiss: (id?: number) => void;
}

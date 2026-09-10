import type { Toast } from "@/stores/toast";

export interface ToastProps {
  toast: Toast | null;
  onDismiss: () => void;
}

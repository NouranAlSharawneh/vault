import { create } from "zustand";
import { TOAST_MS } from "@/constants";
import type { ToastState } from "./toast.types";

let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** One toast at a time, bottom of the main window; auto-dismisses. */
export const useToast = create<ToastState>((set, get) => ({
  toast: null,
  show: (message, action) => {
    const id = ++seq;
    if (timer) clearTimeout(timer);
    set({ toast: { id, message, action } });
    timer = setTimeout(() => get().dismiss(id), TOAST_MS);
    return id;
  },
  dismiss: (id) => {
    if (id !== undefined && get().toast?.id !== id) return;
    if (timer) clearTimeout(timer);
    timer = null;
    set({ toast: null });
  },
}));

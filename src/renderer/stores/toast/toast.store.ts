import { create } from "zustand";
import { TOAST_ACTION_MS, TOAST_MAX, TOAST_MS } from "@/constants";
import type { Toast, ToastState } from "./toast.types";

let seq = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function clearTimer(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}

/**
 * The toast to drop when the stack is full: the oldest one without an action. A failure
 * arriving just after "Moved to trash" used to replace it, and the Undo went with it; a
 * toast you can act on only goes when there is nothing else to drop.
 */
function evict(toasts: Toast[]): Toast {
  return toasts.find((t) => !t.action) ?? toasts[0];
}

/** A few toasts at a time, each on its own clock. The window's host draws them. */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  announced: null,
  show: (message, action) => {
    const id = ++seq;
    const toast = { id, message, action };
    let toasts = [...get().toasts, toast];
    while (toasts.length > TOAST_MAX) {
      const gone = evict(toasts);
      clearTimer(gone.id);
      toasts = toasts.filter((t) => t !== gone);
    }
    set({ toasts, announced: toast });
    // Reading the message, finding the button and reaching it takes longer than reading.
    timers.set(
      id,
      setTimeout(() => get().dismiss(id), action ? TOAST_ACTION_MS : TOAST_MS),
    );

    return id;
  },
  dismiss: (id) => {
    if (id === undefined) {
      for (const t of get().toasts) clearTimer(t.id);
      set({ toasts: [], announced: null });

      return;
    }
    clearTimer(id);
    const { toasts, announced } = get();
    set({
      toasts: toasts.filter((t) => t.id !== id),
      announced: announced?.id === id ? null : announced,
    });
  },
}));

import { create } from "zustand";
import { TOAST_ACTION_MS, TOAST_MAX, TOAST_MS, TOAST_RESUME_MS } from "@/constants";
import type { Toast, ToastState } from "./toast.types";

let seq = 0;

/** Each toast's clock: time left, and since when it has been running (when it is). */
interface Clock {
  timer?: ReturnType<typeof setTimeout>;
  left: number;
  since: number;
}

const clocks = new Map<number, Clock>();
/** Pointer or focus is on the stack: no clock runs. A toast used to go mid-sentence, or
 *  as the pointer reached its Undo (WCAG 2.2.1). */
let held = false;

function clearTimer(id: number) {
  clearTimeout(clocks.get(id)?.timer);
  clocks.delete(id);
}

function run(id: number, clock: Clock, ms: number) {
  clock.since = Date.now();
  clock.left = ms;
  clock.timer = setTimeout(() => useToast.getState().dismiss(id), ms);
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
    const clock: Clock = { left: action ? TOAST_ACTION_MS : TOAST_MS, since: Date.now() };
    clocks.set(id, clock);
    if (!held) run(id, clock, clock.left);

    return id;
  },
  dismiss: (id) => {
    if (id === undefined) {
      for (const t of get().toasts) clearTimer(t.id);
      held = false;
      set({ toasts: [], announced: null });

      return;
    }
    clearTimer(id);
    const { toasts, announced } = get();
    set({
      toasts: toasts.filter((t) => t.id !== id),
      announced: announced?.id === id ? null : announced,
    });
    // No clock runs while held, so this was a click on × or Undo. The toast under the
    // pointer is gone and may never say the pointer left: let the rest run again.
    get().release();
  },
  hold: () => {
    if (held) return;
    held = true;
    for (const clock of clocks.values()) {
      if (!clock.timer) continue;
      clearTimeout(clock.timer);
      clock.timer = undefined;
      clock.left -= Date.now() - clock.since;
    }
  },
  release: () => {
    if (!held) return;
    held = false;
    for (const [id, clock] of clocks) run(id, clock, Math.max(clock.left, TOAST_RESUME_MS));
  },
}));

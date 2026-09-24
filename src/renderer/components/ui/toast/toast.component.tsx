import { X } from "lucide-react";
import { cx } from "@/helpers";
import { fire } from "@/lib/api";
import { Button } from "../button/button.component";
import type { ToastItemProps, ToastPlacement, ToastsProps } from "./toast.types";

/** Newest nearest the edge it sits on. */
const PLACEMENT: Record<ToastPlacement, string> = {
  bottom: "bottom-5",
  "above-footer": "bottom-16",
  top: "top-5 flex-col-reverse",
};

/**
 * Dark pills at the edge of the window, newest nearest the edge, each with an optional
 * action ("Undo").
 *
 * The live region is always in the document and only its text changes: a `role="status"`
 * element that mounts together with its message is not reliably announced.
 */
export function Toasts({
  toasts,
  announced,
  onDismiss,
  placement = "bottom",
  onDark,
}: ToastsProps) {
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announced?.message ?? ""}
      </div>
      {toasts.length > 0 && (
        <div
          className={cx(
            "pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2",
            PLACEMENT[placement],
          )}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onDark={onDark} />
          ))}
        </div>
      )}
    </>
  );
}

function ToastItem({ toast, onDismiss, onDark }: ToastItemProps) {
  return (
    <div
      className={cx(
        "pointer-events-auto flex min-h-9 animate-pop-in items-center gap-3 rounded-md py-1.5 pr-1 pl-3.5 text-sm text-paper shadow-sheet",
        onDark ? "border border-overlay-line bg-overlay-3" : "bg-ink",
      )}
    >
      {/* Three lines, then the rest is a hover away: a truncated error was unreadable. */}
      <span className="line-clamp-3 max-w-md min-w-0 wrap-break-word" title={toast.message}>
        {toast.message}
      </span>
      {toast.action && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-cherry-3 hover:bg-ink-2 hover:text-white"
          onClick={() => {
            const undo = toast.action?.run();
            if (undo) fire(undo, "Couldn’t undo that");
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-6 shrink-0 px-0 text-ink-4 hover:bg-ink-2 hover:text-white"
        onClick={() => onDismiss(toast.id)}
        aria-label="dismiss"
      >
        <X size={12} />
      </Button>
    </div>
  );
}

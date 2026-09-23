import { X } from "lucide-react";
import { fire } from "@/lib/api";
import { Button } from "../button/button.component";
import type { ToastProps } from "./toast.types";

/** Dark pill at the bottom of the window with an optional action ("Undo"). */
export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 bottom-5 z-40 flex justify-center"
    >
      <div className="pointer-events-auto flex h-9 animate-pop-in items-center gap-3 rounded-md bg-ink pr-1 pl-3.5 text-sm text-paper shadow-sheet">
        <span className="max-w-md truncate">{toast.message}</span>
        {toast.action && (
          <Button
            variant="ghost"
            size="sm"
            className="text-cherry-3 hover:bg-ink-2 hover:text-white"
            onClick={() => {
              const undo = toast.action?.run();
              if (undo) fire(undo, "Couldn't undo that");
              onDismiss();
            }}
          >
            {toast.action.label}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-6 px-0 text-ink-4 hover:bg-ink-2 hover:text-white"
          onClick={onDismiss}
          aria-label="dismiss"
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { cx } from "@/helpers";
import type { DialogShellProps } from "./dialog-shell.types";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What every overlay in the app needs and each one used to do differently, or not at all.
 *
 * Focus moves in when it opens and back where it came from when it closes; Tab cycles
 * inside rather than walking into the window behind; Escape closes it from anywhere in
 * the panel, not only from whichever control happens to be focused. The palette used to
 * go keyboard-dead the moment a click landed on a group heading, and the unsaved-changes
 * prompt could not be dismissed with the keyboard at all.
 */
export function DialogShell({
  label,
  onClose,
  children,
  className,
  backdropClassName,
  initialFocus,
}: DialogShellProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const first = initialFocus
      ? panel.current?.querySelector<HTMLElement>(initialFocus)
      : panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    return () => returnTo?.focus?.();
  }, [initialFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();

        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!stops.length) return;
      const edge = e.shiftKey ? stops[0] : stops[stops.length - 1];
      if (document.activeElement === edge || !panel.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={cx("absolute inset-0 z-30 flex justify-center", backdropClassName)}
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx("outline-none", className)}
        // Clicking a heading or the padding inside the panel must not dismiss it, and
        // must not pull focus off whatever was holding it.
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!(e.target as HTMLElement).closest(FOCUSABLE)) e.preventDefault();
        }}
      >
        {children}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { cx } from "@/helpers";
import type { TooltipProps } from "./tooltip.types";

/** Long enough not to fire while the pointer crosses a toolbar, short enough to feel
 *  instant when you rest on a button — the native `title` takes about a second. */
const DELAY = 160;
/** How close to the window edge the label may come before it slides back in. */
const EDGE = 8;

/**
 * A hover label for controls that show only an icon. The browser's own `title` can't be
 * styled and arrives too late to answer "what does this do?", so the app draws its own.
 */
const ALIGN_CLASS = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
} as const;

export function Tooltip({
  label,
  keys,
  side = "bottom",
  align = "center",
  children,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), DELAY);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  // A tooltip left behind by an unmounted button would hang around forever.
  useEffect(() => () => clearTimeout(timer.current), []);

  /**
   * Nudge the label back on screen. The last button in a toolbar sits close enough to the
   * window edge that a centred label hangs off it, and measuring is the only honest way
   * to know — done in the ref callback so there is no state to settle and no reflow loop.
   */
  const place = (el: HTMLSpanElement | null) => {
    if (!el) return;
    el.style.marginLeft = "0px";
    const box = el.getBoundingClientRect();
    const over = box.right - (window.innerWidth - EDGE);
    const under = EDGE - box.left;
    if (over > 0) el.style.marginLeft = `${-over}px`;
    else if (under > 0) el.style.marginLeft = `${under}px`;
  };

  return (
    <span
      className={cx("relative inline-flex", className)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <span
          ref={place}
          role="tooltip"
          className={cx(
            "pointer-events-none absolute z-50 animate-fade-in",
            ALIGN_CLASS[align],
            "rounded-xs bg-overlay px-2 py-1 text-xs whitespace-nowrap text-overlay-ink shadow-pop",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
          )}
        >
          {label}
          {keys && <span className="ml-2 text-overlay-ink-3">{keys}</span>}
        </span>
      )}
    </span>
  );
}

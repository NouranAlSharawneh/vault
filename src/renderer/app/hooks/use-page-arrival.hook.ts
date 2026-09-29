import { type RefObject, useEffect } from "react";

/**
 * Arriving on a page-like view (Settings, a setup step): the window is named after it,
 * and focus moves to its heading, so a screen reader says where you are and Tab starts
 * from the top of it. Focus used to stay on the unmounted button that led here — that
 * is, on <body> — and the window was "Marasca" whatever it showed.
 */
export function usePageArrival(title: string, heading: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = document.title;
    document.title = `${title} — Marasca`;

    return () => {
      document.title = before;
    };
  }, [title]);

  useEffect(() => {
    // Only when nothing else took focus first: a field that autofocuses keeps it.
    const active = document.activeElement;
    if (!active || active === document.body) heading.current?.focus({ preventScroll: true });
  }, [heading]);
}

import { useEffect, useRef } from "react";
import { api, fireQuietly } from "@/lib/api";

/**
 * Keep the sheet's window the height of the sheet itself. It used to be a fixed size
 * whatever was in it, so a one-line clip left dead space under the buttons.
 */
export function useFitWindow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = 0;
    const fit = () => {
      // The panel sits inside the route's padding; include it or the sheet is clipped.
      // An open list hangs below the panel: the window grows to hold it, then shrinks back.
      const box = el.getBoundingClientRect();
      const lists = [...el.querySelectorAll('[role="listbox"]')].map(
        (l) => l.getBoundingClientRect().bottom,
      );
      const bottom = Math.max(box.bottom, ...lists);
      const height = Math.ceil(bottom - box.top + outerPadding(el));
      if (height && height !== last) {
        last = height;
        fireQuietly(api("capture:resize", height), "resizing the sheet");
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    // Lists come and go without the panel changing size.
    const lists = new MutationObserver(fit);
    lists.observe(el, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      lists.disconnect();
    };
  }, []);

  return ref;
}

function outerPadding(el: HTMLElement): number {
  const body = getComputedStyle(document.body);
  const wrapper = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const pad = (s: CSSStyleDeclaration | null) =>
    s ? parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) : 0;

  return pad(body) + pad(wrapper);
}

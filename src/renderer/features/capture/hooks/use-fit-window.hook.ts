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
      const height = Math.ceil(el.getBoundingClientRect().height + outerPadding(el));
      if (height && height !== last) {
        last = height;
        fireQuietly(api("capture:resize", height), "resizing the sheet");
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);

    return () => observer.disconnect();
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

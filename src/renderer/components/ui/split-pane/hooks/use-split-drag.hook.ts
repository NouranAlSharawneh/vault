import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface Options {
  defaultRatio: number;
  minRatio: number;
  maxRatio: number;
  /** Bounds in pixels as well, so a ratio stays sensible on a small or a very wide window. */
  minPx?: number;
  maxPx?: number;
  storageKey?: string;
}

/** How far one arrow key moves the divider. */
const KEY_STEP = 0.02;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readStored(key: string | undefined, fallback: number): number {
  if (!key) return fallback;
  try {
    const v = Number(localStorage.getItem(key));

    return Number.isFinite(v) && v > 0 && v < 1 ? v : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string | undefined, ratio: number): void {
  if (!key) return;
  try {
    localStorage.setItem(key, String(ratio));
  } catch {
    /* storage unavailable */
  }
}

/** Pointer- and key-driven horizontal divider. Returns the ratio, drag state and the handle's props. */
export function useSplitDrag({
  defaultRatio,
  minRatio,
  maxRatio,
  minPx,
  maxPx,
  storageKey,
}: Options) {
  const [ratio, setRatio] = useState(() => readStored(storageKey, defaultRatio));
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  /** Ends a drag that is still going when the pane goes away. */
  const endDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    ro.observe(el);

    return () => ro.disconnect();
  }, []);
  useEffect(() => () => endDrag.current?.(), []);

  // The ratio bounds, tightened by the pixel ones once the width is known.
  const lo = width && minPx ? Math.max(minRatio, minPx / width) : minRatio;
  const hi = width && maxPx ? Math.min(maxRatio, maxPx / width) : maxRatio;
  const shown = clamp(ratio, lo, Math.max(lo, hi));

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = container.current;
      // Only the main button drags; a right-click used to start one.
      if (!el || e.button !== 0) return;
      e.preventDefault();
      setDragging(true);
      const rect = el.getBoundingClientRect();
      const bLo = minPx ? Math.max(minRatio, minPx / rect.width) : minRatio;
      const bHi = maxPx ? Math.min(maxRatio, maxPx / rect.width) : maxRatio;
      let last = ratio;
      const move = (ev: PointerEvent) => {
        last = clamp((ev.clientX - rect.left) / rect.width, bLo, Math.max(bLo, bHi));
        setRatio(last);
      };
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        endDrag.current = null;
        store(storageKey, last);
      };
      endDrag.current = up;
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      // A drag the system takes away (a gesture, a window switch) ends like a release.
      window.addEventListener("pointercancel", up);
    },
    [minRatio, maxRatio, minPx, maxPx, storageKey, ratio],
  );

  /** Back to the default — and remembered, so a relaunch doesn't bring the old one back. */
  const reset = useCallback(() => {
    setRatio(defaultRatio);
    store(storageKey, defaultRatio);
  }, [defaultRatio, storageKey]);

  /** ←/→ move the divider, Enter resets it: it can be reached and used without a mouse. */
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const step = e.key === "ArrowLeft" ? -KEY_STEP : e.key === "ArrowRight" ? KEY_STEP : 0;
      if (step) {
        e.preventDefault();
        const next = clamp(shown + step, lo, Math.max(lo, hi));
        setRatio(next);
        store(storageKey, next);
      } else if (e.key === "Enter") {
        e.preventDefault();
        reset();
      }
    },
    [shown, lo, hi, storageKey, reset],
  );

  return {
    ratio: shown,
    bounds: [lo, hi] as const,
    dragging,
    container,
    onPointerDown,
    onKeyDown,
    reset,
  };
}

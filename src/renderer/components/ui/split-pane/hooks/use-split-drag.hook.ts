import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface Options {
  defaultRatio: number;
  minRatio: number;
  maxRatio: number;
  storageKey?: string;
}

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

/** Pointer-driven horizontal divider. Returns the ratio, drag state and the handle's props. */
export function useSplitDrag({ defaultRatio, minRatio, maxRatio, storageKey }: Options) {
  const [ratio, setRatio] = useState(() => readStored(storageKey, defaultRatio));
  const [dragging, setDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = container.current;
      if (!el) return;
      e.preventDefault();
      setDragging(true);
      const rect = el.getBoundingClientRect();
      const move = (ev: PointerEvent) =>
        setRatio(clamp((ev.clientX - rect.left) / rect.width, minRatio, maxRatio));
      const up = () => {
        setDragging(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setRatio((r) => {
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, String(r));
            } catch {
              /* storage unavailable */
            }
          }

          return r;
        });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [minRatio, maxRatio, storageKey],
  );

  const reset = useCallback(() => setRatio(defaultRatio), [defaultRatio]);

  return { ratio, dragging, container, onPointerDown, reset };
}

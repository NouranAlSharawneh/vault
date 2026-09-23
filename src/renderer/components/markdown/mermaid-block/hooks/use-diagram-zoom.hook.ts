import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import {
  MERMAID_PANE_PAD,
  MERMAID_ZOOM_MAX,
  MERMAID_ZOOM_MIN,
  MERMAID_ZOOM_STEP,
} from "@/constants";
import { svgIntrinsicWidth } from "@/helpers";

const clamp = (z: number) => Math.min(MERMAID_ZOOM_MAX, Math.max(MERMAID_ZOOM_MIN, z));
const round = (z: number) => Math.round(z * 100) / 100;

/**
 * Zoom and drag-to-pan for one diagram. 100% is the size it renders at today — its
 * natural width, or the pane width when it is wider — and the steps scale from there.
 *
 * The width is set explicitly in pixels rather than with a CSS transform or `zoom`:
 * both leave the SVG's own `max-width: 100%` resolving against a container that scales
 * with them, so the two cancel out and nothing visibly changes.
 */
export function useDiagramZoom(svg: string | null, paneRef: RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState<number | null>(null);
  const [canPan, setCanPan] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const natural = useMemo(() => svgIntrinsicWidth(svg), [svg]);
  const width = fitted ? Math.round(fitted * zoom) : undefined;

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane || !natural) return;
    const measure = () => setFitted(Math.min(natural, pane.clientWidth - MERMAID_PANE_PAD));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);

    return () => observer.disconnect();
  }, [natural, paneRef]);

  // Whether there is anywhere to drag to, once the new width has been laid out.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    setCanPan(pane.scrollWidth > pane.clientWidth + 1 || pane.scrollHeight > pane.clientHeight + 1);
  }, [width, svg, paneRef]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pane = paneRef.current;
      if (!pane || !canPan || e.button !== 0) return;
      e.preventDefault();
      pane.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, left: pane.scrollLeft, top: pane.scrollTop };
      setDragging(true);
    },
    [canPan, paneRef],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pane = paneRef.current;
      const from = drag.current;
      if (!pane || !from) return;
      pane.scrollLeft = from.left - (e.clientX - from.x);
      pane.scrollTop = from.top - (e.clientY - from.y);
    },
    [paneRef],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      paneRef.current?.releasePointerCapture(e.pointerId);
      drag.current = null;
      setDragging(false);
    },
    [paneRef],
  );

  const by = useCallback((delta: number) => setZoom((z) => round(clamp(z + delta))), []);

  return {
    zoom,
    width,
    canPan,
    dragging,
    percent: Math.round(zoom * 100),
    zoomIn: () => by(MERMAID_ZOOM_STEP),
    zoomOut: () => by(-MERMAID_ZOOM_STEP),
    reset: () => setZoom(1),
    canZoomIn: zoom < MERMAID_ZOOM_MAX,
    canZoomOut: zoom > MERMAID_ZOOM_MIN,
    isDefault: zoom === 1,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag },
  };
}

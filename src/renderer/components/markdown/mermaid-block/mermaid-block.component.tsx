import { useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { cx } from "@/helpers";
import { useMermaid } from "./hooks/use-mermaid.hook";
import { useDiagramZoom } from "./hooks/use-diagram-zoom.hook";
import type { MermaidBlockProps, MermaidView } from "./mermaid-block.types";

/** A ```mermaid fence: rendered diagram with zoom, and a toggle back to the source. */
export function MermaidBlock({ code }: MermaidBlockProps) {
  const [view, setView] = useState<MermaidView>("rendered");
  const { svg, error } = useMermaid(code);
  const paneRef = useRef<HTMLDivElement>(null);
  const z = useDiagramZoom(svg, paneRef);
  const showZoom = view === "rendered" && !error && !!svg;

  return (
    <div className="mermaid-block not-prose">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper-2 px-3 py-1.5">
        <span className="text-2xs font-semibold tracking-widest text-ink-4 uppercase">Mermaid</span>
        <div className="flex items-center gap-1">
          {showZoom && (
            <div className="mr-1 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-6 px-0"
                disabled={!z.canZoomOut}
                onClick={z.zoomOut}
                title="Zoom out"
                aria-label="zoom out"
              >
                <Minus size={12} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-12 px-0 font-mono text-2xs tabular-nums"
                disabled={z.isDefault}
                onClick={z.reset}
                title="Reset to 100%"
                aria-label="reset zoom"
              >
                {z.percent}%
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 px-0"
                disabled={!z.canZoomIn}
                onClick={z.zoomIn}
                title="Zoom in"
                aria-label="zoom in"
              >
                <Plus size={12} />
              </Button>
            </div>
          )}
          {(["rendered", "code"] as const).map((v) => (
            <Button
              key={v}
              variant="ghost"
              size="sm"
              className={cx("capitalize", view === v && "bg-paper-3 text-ink")}
              onClick={() => setView(v)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>
      {view === "code" || error ? (
        <pre className="m-0 rounded-none border-0">
          <code>{code}</code>
          {error && <div className="mt-2 text-xs text-cherry-3">{error}</div>}
        </pre>
      ) : svg ? (
        <div
          ref={paneRef}
          className={cx(
            "max-h-[70vh] overflow-auto p-4",
            z.canPan && (z.dragging ? "cursor-grabbing select-none" : "cursor-grab"),
          )}
          {...z.panHandlers}
        >
          <div
            className="mermaid-canvas mx-auto"
            style={{ width: z.width }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      ) : (
        <div className="p-4 text-xs text-ink-4">Rendering diagram…</div>
      )}
    </div>
  );
}

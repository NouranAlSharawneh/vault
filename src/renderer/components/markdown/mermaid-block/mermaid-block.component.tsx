import { Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Segmented } from "@/components/ui";
import { cx } from "@/helpers";
import { useDiagramZoom } from "./hooks/use-diagram-zoom.hook";
import { useMermaid } from "./hooks/use-mermaid.hook";
import type { MermaidBlockProps, MermaidView } from "./mermaid-block.types";

const VIEWS = [
  { value: "rendered", label: "Rendered" },
  { value: "code", label: "Code" },
] as const;

/** A ```mermaid fence: rendered diagram with zoom, and a toggle back to the source. */
export function MermaidBlock({ code }: MermaidBlockProps) {
  const [view, setView] = useState<MermaidView>("rendered");
  const { svg, error } = useMermaid(code);
  const paneRef = useRef<HTMLDivElement>(null);
  const z = useDiagramZoom(svg, paneRef, view === "rendered");
  const showZoom = view === "rendered" && !error && !!svg;

  return (
    // A container, so the header fits a narrow reader (the history drawer open): the label
    // goes first, then the zoom percentage, instead of the controls running off the edge.
    <div className="mermaid-block not-prose @container">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper-2 px-3 py-1.5">
        <span className="hidden text-2xs font-semibold tracking-widest text-ink-4 uppercase @sm:inline">
          Mermaid
        </span>
        <div className="ml-auto flex items-center gap-1">
          {showZoom && (
            <div className="mr-1 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
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
                className="hidden w-12 px-0 font-mono text-2xs tabular-nums @xs:inline-flex"
                disabled={z.isDefault}
                onClick={z.reset}
                title="Reset to 100%"
                aria-label="reset zoom"
              >
                {z.percent}%
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!z.canZoomIn}
                onClick={z.zoomIn}
                title="Zoom in"
                aria-label="zoom in"
              >
                <Plus size={12} />
              </Button>
            </div>
          )}
          <Segmented label="Diagram view" options={VIEWS} value={view} onChange={setView} />
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
            "max-h-diagram overflow-auto p-4",
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

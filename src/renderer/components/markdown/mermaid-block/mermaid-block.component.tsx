import { useState } from "react";
import { Button } from "@/components/ui";
import { cx } from "@/helpers";
import { useMermaid } from "./hooks/use-mermaid.hook";
import type { MermaidBlockProps, MermaidView } from "./mermaid-block.types";

/** A ```mermaid fence: rendered diagram with a toggle back to the source. */
export function MermaidBlock({ code }: MermaidBlockProps) {
  const [view, setView] = useState<MermaidView>("rendered");
  const { svg, error } = useMermaid(code);

  return (
    <div className="mermaid-block not-prose">
      <div className="flex items-center justify-between border-b border-line bg-paper-2 px-3 py-1.5">
        <span className="text-2xs font-semibold tracking-widest text-ink-4 uppercase">Mermaid</span>
        <div className="flex gap-1">
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
        <div className="flex justify-center p-4" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="p-4 text-xs text-ink-4">Rendering diagram…</div>
      )}
    </div>
  );
}

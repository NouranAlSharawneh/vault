import { plural } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** The whole clipboard, monospace on the deep-stone surface, scrollable. */
export function CapturePreview({ clip }: CapturePreviewProps) {
  const lines = clip.text.split(/\r?\n/);
  return (
    <div>
      <pre className="m-0 max-h-52 overflow-auto rounded-md bg-black/40 p-4 font-mono text-sm leading-relaxed whitespace-pre text-overlay-ink select-text">
        {lines.map((l, i) => (
          <div key={i} className={/^\s{0,3}#{1,6}\s/.test(l) ? "text-cherry-3" : undefined}>
            {l || " "}
          </div>
        ))}
      </pre>
      <div className="mt-1.5 flex items-center justify-between text-2xs text-overlay-ink-3">
        <span>{plural(lines.length, "line")}</span>
        {!clip.looksLikeMarkdown && (
          <span className="text-warn">doesn't look like markdown — saved as-is</span>
        )}
      </div>
    </div>
  );
}

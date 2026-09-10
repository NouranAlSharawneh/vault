import { CAPTURE_PREVIEW_LINES } from "@/constants";
import { plural } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** First lines of the clipboard, monospace on the deep-stone surface. */
export function CapturePreview({ clip }: CapturePreviewProps) {
  const lines = clip.text.split(/\r?\n/);
  const shown = lines.slice(0, CAPTURE_PREVIEW_LINES);
  const rest = lines.length - shown.length;
  return (
    <div>
      <pre className="m-0 max-h-52 overflow-hidden rounded-md bg-black/40 p-4 font-mono text-sm leading-relaxed text-overlay-ink">
        {shown.map((l, i) => (
          <div key={i} className={/^\s{0,3}#{1,6}\s/.test(l) ? "text-cherry-3" : undefined}>
            {l || " "}
          </div>
        ))}
      </pre>
      <div className="mt-1.5 flex items-center justify-between text-2xs text-overlay-ink-3">
        <span>
          {rest > 0 ? `…${plural(rest, "more line")}` : `${plural(lines.length, "line")}`}
        </span>
        {!clip.looksLikeMarkdown && (
          <span className="text-warn">doesn't look like markdown — saved as-is</span>
        )}
      </div>
    </div>
  );
}

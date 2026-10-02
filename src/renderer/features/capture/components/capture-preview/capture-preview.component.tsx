import { useEffect, useRef, useState } from "react";
import { cx, shortPath } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** Lines drawn in the preview; the rest is counted, not drawn. It's a glance, not an editor. */
const PREVIEW_LINES = 300;

/** The clipboard, monospace on the deep-stone surface, scrollable. */
export function CapturePreview({ clip, compact }: CapturePreviewProps) {
  const all = clip.text.split(/\r?\n/);
  const lines = all.slice(0, PREVIEW_LINES);
  const box = useRef<HTMLPreElement>(null);
  const [more, setMore] = useState(false);

  const measure = () => {
    const el = box.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useEffect(measure, [clip.text, compact]);

  return (
    <div>
      <div className="relative">
        {/* Focusable so a long clip can be scrolled from the keyboard. */}
        <pre
          ref={box}
          tabIndex={0}
          // A named region: aria-label on a bare <pre> is not announced.
          role="region"
          aria-label="Clipboard preview"
          onScroll={measure}
          className={cx(
            "m-0 overflow-auto rounded-md",
            compact ? "max-h-28" : "max-h-52",
            // Wrapped, not scrolled sideways: a long line of prose ran off the sheet.
            "bg-overlay-well p-4 font-mono text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-overlay-ink select-text",
          )}
        >
          {lines.map((l, i) => (
            <div key={i} className={/^\s{0,3}#{1,6}\s/.test(l) ? "text-cherry-3" : undefined}>
              {l || " "}
            </div>
          ))}
          {all.length > PREVIEW_LINES && (
            <div className="text-overlay-ink-3">
              … {(all.length - PREVIEW_LINES).toLocaleString()} more lines
            </div>
          )}
        </pre>
        {/* While there's more below, the last lines fade out instead of stopping mid-line.
          The colour is the preview's own surface, the sheet's well. */}
        {more && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-gradient-to-b from-transparent to-overlay-well"
          />
        )}
      </div>
      {(clip.sourcePath || !clip.looksLikeMarkdown) && (
        <div className="mt-1.5 flex items-center justify-between text-2xs text-overlay-ink-3">
          <span>{clip.sourcePath && <>from {shortPath(clip.sourcePath)}</>}</span>
          {!clip.looksLikeMarkdown && (
            <span className="text-warn">doesn't look like markdown — saved as-is</span>
          )}
        </div>
      )}
    </div>
  );
}

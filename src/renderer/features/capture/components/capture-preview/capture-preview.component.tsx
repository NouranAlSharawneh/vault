import { useEffect, useRef, useState } from "react";
import { cx, shortPath } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** The whole clipboard, monospace on the deep-stone surface, scrollable. */
export function CapturePreview({ clip, compact }: CapturePreviewProps) {
  const lines = clip.text.split(/\r?\n/);
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
          aria-label="Clipboard preview"
          onScroll={measure}
          className={cx(
            "m-0 overflow-auto rounded-md",
            compact ? "max-h-28" : "max-h-52",
            "bg-black/40 p-4 font-mono text-sm leading-relaxed whitespace-pre text-overlay-ink select-text",
          )}
        >
          {lines.map((l, i) => (
            <div key={i} className={/^\s{0,3}#{1,6}\s/.test(l) ? "text-cherry-3" : undefined}>
              {l || " "}
            </div>
          ))}
        </pre>
        {/* While there's more below, the last lines fade out instead of stopping mid-line.
          The colour is the preview's own surface (black/40 over the sheet). */}
        {more && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-md bg-gradient-to-b from-transparent to-[#121211]"
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

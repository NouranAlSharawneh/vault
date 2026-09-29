import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/ui";
import { cx, formatBytes, shortPath } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** Lines drawn in the preview; the rest is counted, not drawn. It's a glance, not an editor. */
const PREVIEW_LINES = 300;

const VARIANTS = [
  { value: "converted", label: "Converted" },
  { value: "raw", label: "As copied" },
] as const;

/** The clipboard, monospace on the deep-stone surface, scrollable. */
export function CapturePreview({ clip, text, variant, onVariant, compact }: CapturePreviewProps) {
  const all = text.split(/\r?\n/);
  const lines = all.slice(0, PREVIEW_LINES);
  const box = useRef<HTMLPreElement>(null);
  const [more, setMore] = useState(false);

  const measure = () => {
    const el = box.current;
    if (el) setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useEffect(measure, [text, compact]);

  const converted = !!clip.converted;
  const unformatted = !converted && !clip.looksLikeMarkdown;
  const origin = clip.image
    ? `Image from the clipboard · ${clip.image.width} × ${clip.image.height} · ${formatBytes(clip.image.bytes)}`
    : clip.sourcePath
      ? `from ${shortPath(clip.sourcePath)}`
      : null;

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
      {(origin || unformatted || converted) && (
        <div className="mt-1.5 flex min-h-6 items-center justify-between gap-3 text-2xs text-overlay-ink-3">
          <span className="min-w-0 truncate">{origin}</span>
          {/* A copied web page: its plain text lost the headings, lists and links, which
              the page's HTML still had. Converted is the default; as copied is a click. */}
          {converted ? (
            <span className="flex shrink-0 items-center gap-2">
              <span>From the page’s formatting</span>
              <Segmented
                dark
                label="Text to save"
                options={VARIANTS}
                value={variant}
                onChange={onVariant}
              />
            </span>
          ) : (
            unformatted && (
              <span className="shrink-0 text-warn">doesn't look like markdown — saved as-is</span>
            )
          )}
        </div>
      )}
    </div>
  );
}

import { cx, plural, shortPath } from "@/helpers";
import type { CapturePreviewProps } from "./capture-preview.types";

/** The whole clipboard, monospace on the deep-stone surface, scrollable. */
export function CapturePreview({ clip, compact }: CapturePreviewProps) {
  const lines = clip.text.split(/\r?\n/);
  return (
    <div>
      <pre
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
      <div className="mt-1.5 flex items-center justify-between text-2xs text-overlay-ink-3">
        <span>
          {plural(lines.length, "line")}
          {clip.sourcePath && <> · from {shortPath(clip.sourcePath)}</>}
        </span>
        {!clip.looksLikeMarkdown && (
          <span className="text-warn">doesn't look like markdown — saved as-is</span>
        )}
      </div>
    </div>
  );
}

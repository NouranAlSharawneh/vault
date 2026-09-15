import { VIDEO_EXTENSIONS } from "@shared/constants";
import { resolveAssetUrl } from "@shared/helpers";
import type { DocImageProps } from "./doc-image.types";

/**
 * `![alt](path)` in a doc, and every raw `<img>` a README carries. Relative paths are
 * served from the vault through `vault://`; a video file behind an image link plays
 * inline, the way GitHub renders it.
 *
 * Images are explicitly inline: Tailwind's preflight makes every `img` a block, which
 * put each of a row of badges on its own line and broke an image mid-sentence.
 *
 * `width`/`height` come through from raw HTML — a README banner written as
 * `<img width="1834">` is sized, not stretched to whatever the pane happens to be — and
 * `max-w-full` still keeps an oversized one inside the column.
 */
export function DocImage({ src, alt, title, width, height, docPath }: DocImageProps) {
  if (!src) return null;
  const url = resolveAssetUrl(src, docPath);
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.has(ext)) {
    return (
      <video
        className="max-w-full rounded-md"
        src={url}
        title={title ?? alt}
        width={width}
        height={height}
        controls
      />
    );
  }

  return (
    <img
      className="inline-block h-auto max-w-full rounded-md align-middle"
      src={url}
      alt={alt ?? ""}
      title={title}
      width={width}
      height={height}
    />
  );
}

import { VIDEO_EXTENSIONS } from "@shared/constants";
import { resolveAssetUrl } from "@shared/helpers";
import type { DocImageProps } from "./doc-image.types";

/**
 * `![alt](path)` in a doc. Relative paths are served from the vault through `vault://`;
 * a video file behind an image link plays inline, the way GitHub renders it.
 */
export function DocImage({ src, alt, title, docPath }: DocImageProps) {
  if (!src) return null;
  const url = resolveAssetUrl(src, docPath);
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.has(ext)) {
    return <video className="max-w-full rounded-md" src={url} title={title ?? alt} controls />;
  }
  return <img className="max-w-full rounded-md" src={url} alt={alt ?? ""} title={title} />;
}

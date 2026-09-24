import { ASSET_HOST, ASSET_SCHEME } from "../constants";
import { docAssetPath } from "./doc-asset-path";

/**
 * Turn a markdown `src` into something the renderer can load. Absolute URLs pass
 * through; repo-relative paths become `marasca://asset/<path>`, resolved GitHub-style
 * against the referencing document's folder (`/x` means the repo root).
 */
export function resolveAssetUrl(src: string, docPath: string): string {
  const path = docAssetPath(src, docPath);
  if (path === null) return src;

  return `${ASSET_SCHEME}://${ASSET_HOST}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

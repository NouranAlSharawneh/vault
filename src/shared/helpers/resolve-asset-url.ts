import { ASSET_HOST, ASSET_SCHEME } from "../constants";

/**
 * Turn a markdown `src` into something the renderer can load. Absolute URLs pass
 * through; repo-relative paths become `vault://asset/<path>`, resolved GitHub-style
 * against the referencing document's folder (`/x` means the repo root).
 */
export function resolveAssetUrl(src: string, docPath: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) return src;
  const clean = src.split(/[?#]/)[0];
  const base = clean.startsWith("/") ? [] : docPath.split("/").slice(0, -1);
  const out: string[] = [...base];
  for (const seg of clean.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return `${ASSET_SCHEME}://${ASSET_HOST}/${out.map(encodeURIComponent).join("/")}`;
}

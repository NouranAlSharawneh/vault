/**
 * Where a markdown `src` points inside the repo, GitHub-style: resolved against the
 * referencing document's folder, with a leading `/` meaning the repo root. Returns null
 * for anything that isn't a repo-relative path — absolute URLs, protocol-relative, anchors.
 * `..` clamps at the root rather than escaping it, so the result is always inside the repo.
 */
export function docAssetPath(src: string, docPath: string): string | null {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(src)) return null;
  const clean = src.split(/[?#]/)[0];
  if (!clean) return null;
  const out = clean.startsWith("/") ? [] : docPath.split("/").slice(0, -1);
  for (const seg of clean.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out.length ? out.join("/") : null;
}

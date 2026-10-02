/**
 * A relative ref as a plain path under its base folder: `./shots/a.png` and
 * `/shots/a.png` (GitHub's repo-root form) are both `shots/a.png`. Written as-is, the `./`
 * form was never found — no file path ends in `/./shots/a.png` — and the root form was
 * looked for at the root of the disk.
 */
export function normalizeRef(ref: string): string {
  const parts: string[] = [];
  for (const seg of ref.replace(/^\/+/, "").split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === ".." && parts.length && parts[parts.length - 1] !== "..") parts.pop();
    else parts.push(seg);
  }

  return parts.join("/");
}

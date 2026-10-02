/**
 * Turn a title or project name into a filesystem/URL-safe slug.
 *
 * Letters and digits of every script survive. Only `a-z0-9` and Arabic used to, so a
 * title in Russian, Chinese, Hebrew or Greek came out as `untitled` — and two projects
 * named in those scripts shared one folder. Latin accents are still folded (`café` →
 * `cafe`); other scripts keep their combining marks, and the result is NFC, the form git
 * records on macOS.
 */
export function slugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip Latin diacritics
    .normalize("NFC")
    .toLowerCase()
    .replace(/['"’`]/g, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  // Cut by code point, not UTF-16 unit, so an emoji or a CJK surrogate pair is never halved.
  return Array.from(s).slice(0, 80).join("").replace(/-+$/, "") || "untitled";
}

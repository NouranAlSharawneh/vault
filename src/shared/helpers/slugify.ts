/** Turn a title or project name into a filesystem/URL-safe slug. */
export function slugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/['"’`]/g, "")
    .replace(/[^a-z0-9؀-ۿ]+/g, "-") // keep arabic letters
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s.slice(0, 80).replace(/-+$/, "") || "untitled";
}

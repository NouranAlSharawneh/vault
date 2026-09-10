/** `research-log` → `Research Log`. Used for orphan files and folder-derived project names. */
export function unslug(s: string): string {
  return s
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** True for a path that only makes sense relative to some folder — not a URL, anchor or data URI. */
export function isRelativeRef(target: string): boolean {
  const t = target.trim();
  if (!t || t.startsWith("#")) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t);
}

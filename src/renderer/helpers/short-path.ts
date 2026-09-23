/** Show a folder the way Finder would: `~/Coding/concorde` instead of the full home path. */
export function shortPath(path: string, home?: string): string {
  const h = home ?? /^\/Users\/[^/]+/.exec(path)?.[0] ?? "";

  return h && path.startsWith(h) ? `~${path.slice(h.length)}` : path;
}

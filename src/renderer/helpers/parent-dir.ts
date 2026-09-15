/** `/a/b/c.md` → `/a/b`; works for POSIX and Windows separators. */
export function parentDir(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  return i > 0 ? path.slice(0, i) : path;
}

/** Pull a title from the first markdown heading, else the first non-empty line. */
export function inferTitle(body: string): string | null {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith("```") && !t.startsWith("---")) {
      return t.replace(/^[-*>\d.\s]+/, "").slice(0, 120);
    }
  }

  return null;
}

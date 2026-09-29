/** A run of a markdown body: prose, or code that must be read as written. */
export interface Segment {
  text: string;
  code: boolean;
}

/** Fenced blocks (``` or ~~~, closed by the same fence) and inline code spans. */
const CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\S\n]*$|`[^`\n]+`/gm;

/**
 * Split a body into prose and code. A README that shows markdown in a code block —
 * `![logo](assets/logo.png)` as an example — has no image there: finding one sent the
 * sheet looking for files, and copying one rewrote the example.
 */
export function splitCode(markdown: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of markdown.matchAll(CODE)) {
    if (m.index > at) out.push({ text: markdown.slice(at, m.index), code: false });
    out.push({ text: m[0], code: true });
    at = m.index + m[0].length;
  }
  if (at < markdown.length) out.push({ text: markdown.slice(at), code: false });

  return out;
}

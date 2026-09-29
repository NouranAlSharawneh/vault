export interface Heading {
  /** 1 for `#`, up to 6. */
  level: number;
  text: string;
  /** 1-based line in the body. */
  line: number;
}

const ATX = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * The document's headings, in order, for the outline. `#` lines inside a fenced code
 * block are code (a shell comment, a Python one), not headings.
 */
export function headingsOf(body: string): Heading[] {
  const out: Heading[] = [];
  let fence: string | null = null;
  body.split("\n").forEach((raw, i) => {
    const open = FENCE.exec(raw);
    if (open) {
      const mark = open[1];
      if (fence === null) fence = mark[0].repeat(mark.length);
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = null;

      return;
    }
    if (fence !== null) return;
    const m = ATX.exec(raw);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
  });

  return out;
}

import { splitCode } from "./split-code";

/** How long a title taken from prose runs before it is cut, at a word. */
const PROSE_TITLE_MAX = 72;

const HEADING = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const HTML_H1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;

/** Headings, links, emphasis and tags read as the words they show. */
function plain(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A title for a body: its top heading, else the start of its first line of prose.
 *
 * Code is not the document: a `# install deps` comment inside a shell block became the
 * title of any answer that had one. A README's centred `<h1 align="center">` is its title,
 * ahead of a `## Features` below it. Only list and quote markers are taken off prose —
 * "3D printing notes" used to lose its 3, and "2026 roadmap" its year.
 */
export function inferTitle(body: string): string | null {
  const prose = splitCode(body)
    .filter((s) => !s.code)
    .map((s) => s.text)
    .join("\n");
  const lines = prose.split(/\r?\n/);
  const headings = lines
    .map((line) => HEADING.exec(line))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ level: m[1].length, text: plain(m[2]) }))
    .filter((h) => h.text);
  const html = HTML_H1.exec(prose);
  const h1 = headings.find((h) => h.level === 1)?.text;
  const htmlTitle = html ? plain(html[1]) : "";
  if (h1 || htmlTitle) {
    // Whichever comes first in the text.
    if (h1 && htmlTitle)
      return prose.indexOf(html![0]) < prose.search(/^\s{0,3}#\s/m) ? htmlTitle : h1;

    return h1 || htmlTitle;
  }
  if (headings.length) return headings[0].text;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("---") || t.startsWith("<")) continue;
    const text = plain(t.replace(/^(?:[-*+>]|\d+[.)])\s+/, ""));
    if (text) return shorten(text);
  }

  return null;
}

/** The first sentence, or as much as fits, cut at a word rather than mid-word. */
function shorten(text: string): string {
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  if (sentence.length <= PROSE_TITLE_MAX) return sentence;
  const cut = sentence.slice(0, PROSE_TITLE_MAX);
  const space = cut.lastIndexOf(" ");

  return `${(space > 20 ? cut.slice(0, space) : cut).replace(/[,;:]$/, "")}…`;
}

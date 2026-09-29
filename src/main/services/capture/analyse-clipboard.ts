import { countWords, inferTitle } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";
import { detectSource } from "./detect-source";
import { htmlToMarkdown } from "./html-to-markdown";

/** How much of markdown's syntax the text uses: two signals or more reads as markdown. */
export function markdownSignals(text: string): number {
  return (
    (/^\s{0,3}#{1,6}\s/m.test(text) ? 2 : 0) +
    (/```/.test(text) ? 2 : 0) +
    (/^\s*[-*+]\s+\S/m.test(text) ? 1 : 0) +
    (/^\s*\d+\.\s+\S/m.test(text) ? 1 : 0) +
    (/\*\*[^*]+\*\*/.test(text) ? 1 : 0) +
    (/\[[^\]]+\]\([^)]+\)/.test(text) ? 1 : 0) +
    (/^\s*>\s/m.test(text) ? 1 : 0) +
    (/^\s*\|.*\|\s*$/m.test(text) ? 1 : 0)
  );
}

/**
 * The HTML flavour as markdown, when it's worth offering: the text isn't markdown, and the
 * conversion has structure the text doesn't. A plain paragraph copied from a page comes
 * back as the same paragraph, and a toggle between two identical texts is noise.
 */
function convertedFrom(text: string, html: string, looksLikeMarkdown: boolean): string | undefined {
  if (!html.trim() || looksLikeMarkdown) return undefined;
  let converted: string;
  try {
    converted = htmlToMarkdown(html);
  } catch {
    return undefined;
  }
  if (!converted || converted === text.trim()) return undefined;

  return markdownSignals(converted) >= 2 ? converted : undefined;
}

/** Pure heuristics over clipboard text: is it markdown, what's the title, where is it from. */
export function analyseClipboard(text: string, html = ""): ClipboardCapture {
  const looksLikeMarkdown = markdownSignals(text) >= 2;
  const converted = convertedFrom(text, html, looksLikeMarkdown);

  return {
    text,
    words: countWords(text),
    lines: text.split(/\r?\n/).length,
    looksLikeMarkdown,
    detectedSource: detectSource(text, html),
    detectedTitle: inferTitle(text),
    ...(converted ? { converted } : {}),
  };
}

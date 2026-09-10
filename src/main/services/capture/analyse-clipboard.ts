import { countWords, inferTitle } from "@shared/helpers";
import type { ClipboardCapture } from "@shared/types";
import { detectSource } from "./detect-source";

/** Pure heuristics over clipboard text: is it markdown, what's the title, where is it from. */
export function analyseClipboard(text: string, html = ""): ClipboardCapture {
  const signals =
    (/^\s{0,3}#{1,6}\s/m.test(text) ? 2 : 0) +
    (/```/.test(text) ? 2 : 0) +
    (/^\s*[-*+]\s+\S/m.test(text) ? 1 : 0) +
    (/^\s*\d+\.\s+\S/m.test(text) ? 1 : 0) +
    (/\*\*[^*]+\*\*/.test(text) ? 1 : 0) +
    (/\[[^\]]+\]\([^)]+\)/.test(text) ? 1 : 0) +
    (/^\s*>\s/m.test(text) ? 1 : 0) +
    (/^\s*\|.*\|\s*$/m.test(text) ? 1 : 0);
  return {
    text,
    words: countWords(text),
    lines: text.split(/\r?\n/).length,
    looksLikeMarkdown: signals >= 2,
    detectedSource: detectSource(text, html),
    detectedTitle: inferTitle(text),
  };
}

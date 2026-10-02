import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

let service: TurndownService | null = null;

function turndown(): TurndownService {
  if (service) return service;
  service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    hr: "---",
  });
  // Tables, ~~strikethrough~~ and task lists, the way GitHub writes them.
  service.use(gfm);
  // What a browser puts around a copied fragment, which is not part of what was copied.
  service.remove(["style", "script", "head", "meta", "title", "noscript"]);

  return service;
}

/**
 * A copied web page as markdown. A browser puts the selection on the clipboard twice:
 * as plain text, which has lost its headings, lists, links and tables, and as HTML, which
 * still has them.
 */
export function htmlToMarkdown(html: string): string {
  // Browsers wrap the selection in comment markers; they are not content.
  const fragment = html.replace(/<!--(?:StartFragment|EndFragment)-->/g, "");

  return (
    turndown()
      .turndown(fragment)
      // Turndown pads list markers to four columns ("-   item"); one space is how
      // markdown is written, and how the rest of the vault is.
      .replace(/^(\s*)([-+*]|\d+\.) {2,}/gm, "$1$2 ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

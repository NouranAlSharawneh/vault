import type { Source } from "@shared/types";

/** A domain as an address — after `//`, a quote, a space or a dot — not a word in the text. */
const at = (domains: string) => new RegExp(`(?:^|[\\s"'/.])(?:${domains})\\b`);
const CLAUDE = at("claude\\.ai");
const CHATGPT = at("chatgpt\\.com|chat\\.openai\\.com");
const GITHUB = at("github\\.com");

/**
 * Guess where clipboard text came from by where the page was: the HTML the browser put
 * on the clipboard carries the page's addresses and classes. Addresses, not words —
 * "anthropic" or "openai" anywhere in a page (the README of `openai-python` on GitHub,
 * say) used to label it as the chat app.
 */
export function detectSource(text: string, html: string): Source {
  const h = html.toLowerCase();
  if (CLAUDE.test(h) || /class="[^"]*font-claude/.test(h)) return "claude";
  if (CHATGPT.test(h)) return "chatgpt";
  if (GITHUB.test(h) || h.includes("markdown-body")) return "github";
  // Plain text only: an answer that names its source in its opening lines.
  const head = text.slice(0, 400);
  if (/\bclaude\b(?![-_])/i.test(head)) return "claude";
  if (/\bchatgpt\b/i.test(head)) return "chatgpt";

  return "manual";
}

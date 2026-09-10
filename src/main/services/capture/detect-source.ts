import type { Source } from "@shared/types";

/** Guess where clipboard text came from using the HTML flavour and leading text. */
export function detectSource(text: string, html: string): Source {
  const h = html.toLowerCase();
  if (h.includes("claude.ai") || h.includes("anthropic") || /class="[^"]*font-claude/.test(h))
    return "claude";
  if (h.includes("chatgpt.com") || h.includes("chat.openai.com") || h.includes("openai"))
    return "chatgpt";
  if (h.includes("github.com") || h.includes("markdown-body")) return "github";
  const head = text.slice(0, 400);
  if (/\bclaude\b/i.test(head)) return "claude";
  if (/\bchatgpt\b/i.test(head)) return "chatgpt";
  return "manual";
}

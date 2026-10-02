export interface TextPart {
  text: string;
  match: boolean;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `text` cut into the parts that match one of `words` (ignoring case) and the parts in
 * between, so a result can show why it was found. The longest words are tried first, so
 * "rate" inside "rate-limit" doesn't split a match for "rate-limit".
 */
export function splitMatches(text: string, words: string[]): TextPart[] {
  const wanted = words.filter((w) => w.trim()).sort((a, b) => b.length - a.length);
  if (!wanted.length || !text) return [{ text, match: false }];
  // A capturing split puts every match at an odd index, between what surrounds it.
  const parts = text.split(new RegExp(`(${wanted.map(escape).join("|")})`, "i"));

  return parts.map((part, i) => ({ text: part, match: i % 2 === 1 })).filter((p) => p.text);
}

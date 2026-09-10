/** Plain-text preview of a body: no first heading, no code, no markdown punctuation. */
import { EXCERPT_LENGTH } from "../constants";

export function excerptOf(body: string, max = EXCERPT_LENGTH): string {
  const text = body
    .replace(/^\s*#{1,6}\s.*$/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`>#[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

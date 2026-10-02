import { splitCode } from "@shared/helpers";
import type { TagSummary } from "@shared/types";

/** Tags shorter than this match too much of any text to mean anything ("a", "ux"). */
const MIN_TAG_LENGTH = 3;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The tag as words: `api-design` also matches "API design" and "api_design". */
function tagPattern(tag: string): RegExp {
  const words = tag
    .split(/[-_\s]+/)
    .map(escape)
    .join("[-_\\s]+");

  return new RegExp(`(?<![\\p{L}\\p{N}])${words}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Tags the vault already uses that this clip talks about, best first: named in a heading
 * beats named in the text, more mentions beat fewer, and a tag used on more documents
 * wins a tie. Code is left out — an import line is not a topic. Tags already chosen, and
 * very short ones, are never suggested.
 */
export function suggestTags(
  text: string,
  tags: TagSummary[],
  chosen: string[],
  limit = 5,
): string[] {
  const prose = splitCode(text)
    .filter((s) => !s.code)
    .map((s) => s.text)
    .join("\n");
  const headings = prose
    .split("\n")
    .filter((l) => /^\s{0,3}#{1,6}\s/.test(l))
    .join("\n");
  const taken = new Set(chosen.map((t) => t.toLowerCase()));

  return tags
    .filter((t) => t.tag.length >= MIN_TAG_LENGTH && !taken.has(t.tag.toLowerCase()))
    .map((t) => {
      const pattern = tagPattern(t.tag);
      const mentions = prose.match(pattern)?.length ?? 0;
      const inHeading = (headings.match(pattern)?.length ?? 0) > 0;

      return { t, score: mentions ? Math.min(mentions, 5) + (inHeading ? 10 : 0) : 0 };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.t.count - a.t.count)
    .slice(0, limit)
    .map((s) => s.t.tag);
}

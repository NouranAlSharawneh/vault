import { SOURCES } from "../constants";
import type { Source } from "../types";

/**
 * `Source` is a union of five strings, and the three places a source arrives from
 * outside — a document's frontmatter, a `from:` in the search box, and the select in the
 * editor — each used to assert their way into it with `as Source`. Frontmatter can say
 * anything, and so can the search box.
 */
export function isSource(value: unknown): value is Source {
  return typeof value === "string" && (SOURCES as readonly string[]).includes(value);
}

/** The same, for a field that must end up with a value: anything unrecognised is "other". */
export function toSource(value: unknown): Source {
  const s = typeof value === "string" ? value.toLowerCase() : null;

  return isSource(s) ? s : "other";
}

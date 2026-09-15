import type { DocMeta } from "../types";
import type { ParsedQuery } from "./query.types";

/** Structured filters only — free-text matching is done by the search index. */
export function matchesFilters(doc: DocMeta, q: ParsedQuery): boolean {
  if (
    q.project.length &&
    !q.project.some((p) => doc.project.toLowerCase() === p || doc.projectSlug === p)
  ) {
    return false;
  }
  if (q.tagsEmpty && doc.tags.length) return false;
  if (q.tags.length) {
    const have = doc.tags.map((t) => t.toLowerCase());
    if (!q.tags.every((t) => have.includes(t))) return false;
  }
  if (q.source.length && !q.source.includes(doc.source)) return false;
  if (q.starred && !doc.starred) return false;
  if (q.unpushed && !doc.unpushed) return false;
  if (q.orphan && !doc.orphan) return false;
  if (q.createdAfter !== undefined || q.createdBefore !== undefined) {
    const t = Date.parse(doc.created);
    if (q.createdAfter !== undefined && !(t >= q.createdAfter)) return false;
    if (q.createdBefore !== undefined && !(t <= q.createdBefore)) return false;
  }

  return true;
}

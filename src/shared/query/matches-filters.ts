import type { DocMeta } from "../types";
import type { ParsedQuery } from "./query.types";

/** Structured filters only — free-text matching is done by the search index. */
export function matchesFilters(doc: DocMeta, q: ParsedQuery): boolean {
  return matchesWhere(doc, q) && matchesWhat(doc, q) && matchesWhen(doc, q);
}

/** Project and tags. */
function matchesWhere(doc: DocMeta, q: ParsedQuery): boolean {
  if (
    q.project.length &&
    !q.project.some((p) => doc.project.toLowerCase() === p || doc.projectSlug === p)
  )
    return false;
  if (q.tagsEmpty && doc.tags.length) return false;
  if (!q.tags.length) return true;
  const have = doc.tags.map((t) => t.toLowerCase());

  return q.tags.every((t) => have.includes(t));
}

/** Source and the `is:` flags. */
function matchesWhat(doc: DocMeta, q: ParsedQuery): boolean {
  if (q.source.length && !q.source.includes(doc.source)) return false;
  if (q.starred && !doc.starred) return false;
  if (q.unpushed && !doc.unpushed) return false;

  return !q.orphan || doc.orphan;
}

function matchesWhen(doc: DocMeta, q: ParsedQuery): boolean {
  if (q.createdAfter === undefined && q.createdBefore === undefined) return true;
  const t = Date.parse(doc.created);
  if (q.createdAfter !== undefined && !(t >= q.createdAfter)) return false;

  return q.createdBefore === undefined || t <= q.createdBefore;
}

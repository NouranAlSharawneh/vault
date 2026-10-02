import { projectSlug } from "@shared/helpers";
import type { ParsedQuery } from "@shared/query";
import type { ListFilter } from "../../../main.types";

/**
 * The list filter that shows exactly what this query finds, when the list can: a project
 * or Starred (not both — a project replaces the collection in the list), with any tags.
 * Null for anything else — words, dates, sources — which the list has no way to narrow by,
 * so "show in the list" would show something other than what the palette found.
 */
export function listFilterFor(
  q: ParsedQuery,
): Pick<ListFilter, "collection" | "project" | "tags"> | null {
  const unsupported =
    !!q.text ||
    q.tagsEmpty ||
    q.source.length > 0 ||
    q.unpushed !== undefined ||
    q.orphan !== undefined ||
    q.createdAfter !== undefined ||
    q.createdBefore !== undefined ||
    q.starred === false ||
    q.project.length > 1 ||
    (q.project.length === 1 && q.starred);
  if (unsupported) return null;
  if (!q.project.length && !q.starred && !q.tags.length) return null;

  return {
    collection: q.starred ? "starred" : "all",
    project: q.project.length ? projectSlug(q.project[0]) : null,
    tags: q.tags,
  };
}

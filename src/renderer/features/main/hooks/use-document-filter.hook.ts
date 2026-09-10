import { useCallback, useMemo, useState } from "react";
import type { DocMeta, IndexSnapshot, TrashedDoc } from "@shared/types";
import { RECENT_DAYS } from "@/constants";
import type { FilteredDocs, ListFilter } from "../main.types";

const DEFAULT: ListFilter = { collection: "all", project: null, tags: [], sort: "newest" };

/** Settings links here as `#main?trash`; consume the flag so a later ⌘\ doesn't re-apply it. */
function initialFilter(): ListFilter {
  if (!window.location.hash.includes("?trash")) return DEFAULT;
  window.history.replaceState(null, "", "#main");
  return { ...DEFAULT, collection: "trash" };
}

export function applyFilter(
  index: IndexSnapshot | null,
  f: ListFilter,
  trash: TrashedDoc[] = [],
  now = Date.now(),
): FilteredDocs {
  if (!index) return { docs: [], title: "All documents" };
  if (f.collection === "trash") {
    // Already newest-trashed first; tags and sort don't apply here.
    return { docs: trash.map((t) => t.meta), title: "Trash" };
  }
  const cutoff = now - RECENT_DAYS * 86_400_000;
  let docs = index.docs;
  let title = "All documents";
  if (f.project) {
    docs = docs.filter((d) => d.projectSlug === f.project);
    title = index.projects.find((p) => p.slug === f.project)?.name ?? f.project;
  } else if (f.collection === "recent") {
    docs = docs.filter((d) => Math.max(Date.parse(d.created), d.mtime) >= cutoff);
    title = "Recent";
  } else if (f.collection === "starred") {
    docs = docs.filter((d) => d.starred);
    title = "Starred";
  }
  if (f.tags.length) docs = docs.filter((d) => f.tags.every((t) => d.tags.includes(t)));
  docs = [...docs].sort(sorter(f.sort));
  return { docs, title };
}

function sorter(sort: ListFilter["sort"]): (a: DocMeta, b: DocMeta) => number {
  switch (sort) {
    case "oldest":
      return (a, b) => a.created.localeCompare(b.created);
    case "title":
      return (a, b) => a.title.localeCompare(b.title);
    default:
      return (a, b) => b.created.localeCompare(a.created);
  }
}

/** Sidebar selection + tag chips + sort → the visible document list. */
export function useDocumentFilter(index: IndexSnapshot | null, trash: TrashedDoc[] = []) {
  const [filter, setFilter] = useState<ListFilter>(initialFilter);
  const result = useMemo(() => applyFilter(index, filter, trash), [index, filter, trash]);

  const selectProject = (slug: string | null) =>
    setFilter((f) => ({ ...f, project: slug, collection: "all" }));
  const selectCollection = (c: ListFilter["collection"]) =>
    setFilter((f) => ({ ...f, collection: c, project: null }));
  const toggleTag = (tag: string) =>
    setFilter((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  const clearTags = () => setFilter((f) => ({ ...f, tags: [] }));
  /** Back to an unfiltered list, keeping the chosen sort. Stable, so effects can depend on it. */
  const showAll = useCallback(() => setFilter((f) => ({ ...DEFAULT, sort: f.sort })), []);
  const setSort = (sort: ListFilter["sort"]) => setFilter((f) => ({ ...f, sort }));

  return {
    filter,
    ...result,
    selectProject,
    selectCollection,
    toggleTag,
    clearTags,
    setSort,
    showAll,
  };
}

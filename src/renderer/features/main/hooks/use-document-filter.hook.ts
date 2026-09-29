import { useCallback, useEffect, useMemo } from "react";
import { RECENT_DAYS } from "@/constants";
import { DEFAULT_FILTER as DEFAULT, useLibrary } from "@/stores/library";
import type { DocMeta, IndexSnapshot, TrashedDoc } from "@shared/types";
import type { FilteredDocs, ListFilter } from "../main.types";

/** Settings links here as `#main?trash`; consume the flag so a later ⌘\ doesn't re-apply it. */
function consumeTrashIntent(): boolean {
  if (!window.location.hash.includes("?trash")) return false;
  window.history.replaceState(null, "", "#main");

  return true;
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
    docs = docs.filter((d) => touchedAt(d) >= cutoff);
    title = "Recent";
  } else if (f.collection === "starred") {
    docs = docs.filter((d) => d.starred);
    title = "Starred";
  }
  // Tags narrow every collection. Recent used to return before this line, so its chips
  // showed tags that filtered nothing, and "Clear tag" cleared nothing.
  if (f.tags.length) docs = docs.filter((d) => f.tags.every((t) => d.tags.includes(t)));
  // Recent is an ordering, not just a window: sorted by when you last touched a doc, which
  // is also why it offers no sort control. A stored "title" order from another collection
  // must not silently reorder it.
  const order =
    f.collection === "recent" && !f.project
      ? (a: DocMeta, b: DocMeta) => touchedAt(b) - touchedAt(a)
      : sorter(f.sort);

  return { docs: [...docs].sort(order), title };
}

/** `created` as epoch ms, or null when the frontmatter date doesn't parse. */
function createdAt(d: DocMeta): number | null {
  const t = Date.parse(d.created);

  return Number.isNaN(t) ? null : t;
}

/**
 * When a document was last touched: saved or edited, whichever is later. This is what
 * Recent sorts by, so it is also the time Recent shows. A `created` that doesn't parse
 * falls back to the file's mtime rather than poisoning the max with NaN.
 */
export function touchedAt(d: DocMeta): number {
  return Math.max(createdAt(d) ?? 0, Number.isFinite(d.mtime) ? d.mtime : 0);
}

/**
 * By `created` as an instant, not as a string: `2026-09-01` and `2026-09-01T09:00:00+03:00`
 * don't compare correctly as text. Documents with no usable date go last either way.
 */
const byCreated =
  (dir: 1 | -1) =>
  (a: DocMeta, b: DocMeta): number => {
    const x = createdAt(a);
    const y = createdAt(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;

    return dir * (x - y);
  };

/** "Doc 2" before "Doc 10", and "a" beside "A": the order a person expects from names. */
const titles = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function sorter(sort: ListFilter["sort"]): (a: DocMeta, b: DocMeta) => number {
  switch (sort) {
    case "oldest":
      return byCreated(1);
    case "title":
      // Equal titles fall back to newest first, so the order never shuffles between renders.
      return (a, b) => titles.compare(a.title, b.title) || byCreated(-1)(a, b);
    default:
      return byCreated(-1);
  }
}

/**
 * What stays selected once the list has changed underneath it: the same document if it is
 * still in the list, else the list's first, else nothing.
 */
export function reconcileSelection(selected: string | null, docs: DocMeta[]): string | null {
  if (selected && docs.some((d) => d.path === selected)) return selected;

  return docs[0]?.path ?? null;
}

/**
 * Sidebar selection + tag chips + sort → the visible document list.
 * `onSwitch` hears the new list whenever a collection or project is picked, so the reader
 * never keeps showing a document the list no longer has (a live doc inside Trash, say).
 */
export function useDocumentFilter(
  index: IndexSnapshot | null,
  trash: TrashedDoc[] = [],
  onSwitch?: (docs: DocMeta[]) => void,
) {
  const filter = useLibrary((s) => s.filter);
  const setFilter = useLibrary((s) => s.setFilter);
  const result = useMemo(() => applyFilter(index, filter, trash), [index, filter, trash]);

  // Arriving from Settings' "Open trash".
  useEffect(() => {
    if (consumeTrashIntent()) setFilter((f) => ({ ...f, collection: "trash", project: null }));
  }, [setFilter]);

  // The last document of a project went (trashed, moved): the project is gone from the
  // sidebar, and the list was left titled with its raw folder name, highlighting nothing.
  const projectGone =
    !!index && !!filter.project && !index.projects.some((p) => p.slug === filter.project);
  useEffect(() => {
    if (projectGone) setFilter((f) => ({ ...DEFAULT, sort: f.sort }));
  }, [projectGone, setFilter]);

  // Worked out from the filter this render sees rather than in a state updater: it runs on a
  // click, and the caller needs the list it is about to show, not the one on screen.
  const switchTo = (next: ListFilter) => {
    setFilter(next);
    onSwitch?.(applyFilter(index, next, trash).docs);
  };
  const selectProject = (slug: string | null) =>
    switchTo({ ...filter, project: slug, collection: "all" });
  const selectCollection = (c: ListFilter["collection"]) =>
    switchTo({ ...filter, collection: c, project: null });
  const toggleTag = (tag: string) =>
    setFilter((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  const clearTags = () => setFilter((f) => ({ ...f, tags: [] }));
  /** Back to an unfiltered list, keeping the chosen sort. Stable, so effects can depend on it. */
  const showAll = useCallback(() => setFilter((f) => ({ ...DEFAULT, sort: f.sort })), [setFilter]);
  const setSort = (sort: ListFilter["sort"]) => setFilter((f) => ({ ...f, sort }));

  /** True when the list is showing less than everything, so a reveal can say so. */
  const filtered =
    filter.collection !== DEFAULT.collection || !!filter.project || filter.tags.length > 0;

  // Trash ignores tags, so chips there would be inert and "Clear tags" a lie.
  const activeTags = filter.collection === "trash" ? [] : filter.tags;
  // Each row shows the time its list is ordered by: Recent by last touch, Trash by when it
  // was trashed — Trash used to show the created date beside a list ordered otherwise.
  const trashedAt = useMemo(() => new Map(trash.map((t) => [t.meta.path, t.trashedAt])), [trash]);
  const dateOf =
    filter.collection === "recent"
      ? touchedAt
      : filter.collection === "trash"
        ? (d: DocMeta) => trashedAt.get(d.path) ?? d.mtime
        : undefined;

  return {
    filter,
    filtered,
    activeTags,
    dateOf,
    ...result,
    selectProject,
    selectCollection,
    toggleTag,
    clearTags,
    setSort,
    showAll,
  };
}

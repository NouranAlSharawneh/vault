import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  PALETTE_MAX_DOCS,
  PALETTE_MAX_RECENT,
  PALETTE_MAX_TEXT,
  SEARCH_DEBOUNCE_MS,
} from "@/constants";
import { PALETTE_ACTIONS, type PaletteActionKey } from "@/data/palette.data";
import { describePull, describePush, plural } from "@/helpers";
import { api, fire, rescanVault } from "@/lib/api";
import { useApp } from "@/stores/app";
import { recentOpened } from "@/stores/library";
import { useToast } from "@/stores/toast";
import { matchesFilters, type ParsedQuery, parseQuery } from "@shared/query";
import type { DocMeta, SearchHit, SyncStatus } from "@shared/types";
import type { PaletteGroup, PaletteItem, PaletteListFilter } from "../command-palette.types";
import { listFilterFor } from "../helpers/list-filter-for";

interface ActionContext {
  sync: SyncStatus | null;
  hasRemote: boolean;
  hasDoc: boolean;
  /** The open document's title, so the trash action says which one it will trash. */
  trashTitle?: string;
  /** Lower-cased search text; empty shows everything. */
  q: string;
}

/** The actions that apply right now, labelled for the state they would act on. */
function availableActions({
  sync,
  hasRemote,
  hasDoc,
  trashTitle,
  q,
}: ActionContext): PaletteItem[] {
  const pending = sync?.ahead ?? 0;
  const conflicts = sync?.conflicts ?? 0;

  return (
    PALETTE_ACTIONS.filter(
      (a) =>
        (!a.needsPending || pending > 0) &&
        (!a.needsDoc || hasDoc) &&
        (!a.needsConflicts || conflicts > 0) &&
        (!a.needsRemote || hasRemote),
    )
      .map((a) => ({
        data: a,
        label:
          a.key === "pushPending"
            ? `Push ${plural(pending, "pending doc")}`
            : a.key === "trashDoc" && trashTitle
              ? `Move “${trashTitle}” to trash`
              : a.label,
      }))
      // The shown label names the open doc; the generic one keeps "move document" findable.
      .filter(
        ({ data, label }) =>
          !q || label.toLowerCase().includes(q) || data.label.toLowerCase().includes(q),
      )
      .map(({ data, label }) => ({
        kind: "action",
        key: data.key,
        label,
        shortcut: data.shortcut,
      }))
  );
}

/**
 * Words typed: title and tag hits, then hits in the text. Until the search has answered
 * these words, titles are matched from the index, so something useful shows at once.
 */
function textGroups(
  docs: DocMeta[],
  text: string,
  hits: SearchHit[],
  answered: boolean,
  passes: (d: DocMeta) => boolean,
): PaletteGroup[] {
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const titleHits: PaletteItem[] = [];
  const textHits: PaletteItem[] = [];
  const q = text.toLowerCase();
  if (!answered)
    for (const d of docs) {
      if (titleHits.length >= PALETTE_MAX_DOCS) break;
      if (passes(d) && d.title.toLowerCase().includes(q)) titleHits.push({ kind: "doc", doc: d });
    }
  for (const h of hits) {
    const d = byPath.get(h.path);
    if (!d || !passes(d)) continue;
    if (d.title.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q)))
      titleHits.push({ kind: "doc", doc: d });
    else if (h.snippet) textHits.push({ kind: "text", doc: d, snippet: h.snippet });
    else titleHits.push({ kind: "doc", doc: d });
  }
  const out: PaletteGroup[] = [];
  if (titleHits.length)
    out.push({ title: "Documents", items: titleHits.slice(0, PALETTE_MAX_DOCS) });
  if (textHits.length) out.push({ title: "In text", items: textHits.slice(0, PALETTE_MAX_TEXT) });

  return out;
}

/**
 * Nothing typed: what was last read, most recent first — topped up with the newest
 * documents when little has been opened yet. It used to be the newest documents alone,
 * so the one you had just left was rarely there to go back to.
 */
function recentDocs(docs: DocMeta[]): DocMeta[] {
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const opened = recentOpened().flatMap((p) => byPath.get(p) ?? []);
  const seen = new Set(opened.map((d) => d.path));

  return [...opened, ...docs.filter((d) => !seen.has(d.path))].slice(0, PALETTE_MAX_RECENT);
}

/** "Show these 12 in the list", when the list can show exactly what the query found. */
function showInListAction(
  docs: DocMeta[],
  parsed: ParsedQuery,
  passes: (d: DocMeta) => boolean,
): PaletteItem[] {
  if (!listFilterFor(parsed)) return [];
  const n = docs.filter(passes).length;

  return n
    ? [
        {
          kind: "action",
          key: "showInList",
          label: `Show ${plural(n, "match", "matches")} in the list`,
        },
      ]
    : [];
}

/** Filters only (e.g. `tags:spec is:starred`) or nothing typed → matching docs, or Recent. */
function filterGroups(
  docs: DocMeta[],
  searching: boolean,
  passes: (d: DocMeta) => boolean,
): PaletteGroup[] {
  const filtered = searching ? docs.filter(passes).slice(0, PALETTE_MAX_DOCS) : recentDocs(docs);

  return filtered.length
    ? [
        {
          title: searching ? "Matching" : "Recent",
          items: filtered.map((doc) => ({ kind: "doc" as const, doc })),
        },
      ]
    : [];
}

/** Query → grouped results (documents · in text · actions) with keyboard navigation. */
export function useCommandPalette(
  onOpenDoc: (path: string) => void,
  onClose: () => void,
  onTrashDoc?: () => void,
  onReviewConflicts?: () => void,
  trashTitle?: string,
  onShowInList?: (filter: PaletteListFilter) => void,
) {
  const index = useApp((s) => s.index);
  const sync = useApp((s) => s.sync);
  const hasRemote = useApp((s) => !!s.config?.remote);
  const show = useToast((s) => s.show);
  const [query, setQuery] = useState("");
  // Hits remember the query they answer. Grouped against newer text, the last answer
  // showed old snippets under new words for a moment — and Enter could open one of them.
  const [answered, setAnswered] = useState<{ query: string; hits: SearchHit[] }>({
    query: "",
    hits: [],
  });
  const [cursor, setCursor] = useState(0);

  const text = parseQuery(query).text;

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api("search:query", text, query)
        .then((h) => !cancelled && setAnswered({ query, hits: h }))
        .catch(() => !cancelled && setAnswered({ query, hits: [] }));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, query]);

  // With no text the structured filters alone drive the list. Until the search answers,
  // titles are matched here, so something useful shows at once instead of "No matches".
  const current = answered.query === query;
  const liveHits = useMemo(() => (text && current ? answered.hits : []), [text, current, answered]);

  const groups = useMemo<PaletteGroup[]>(() => {
    const docs = index?.docs ?? [];
    const parsed = parseQuery(query);
    const passes = (d: DocMeta) => matchesFilters(d, parsed);
    const out: PaletteGroup[] = [];

    out.push(
      ...(parsed.text
        ? textGroups(docs, parsed.text, liveHits, current, passes)
        : filterGroups(docs, !!query.trim(), passes)),
    );

    const visibleActions = [
      ...(onShowInList ? showInListAction(docs, parsed, passes) : []),
      ...availableActions({
        sync,
        hasRemote,
        hasDoc: !!onTrashDoc,
        trashTitle,
        q: parsed.text.toLowerCase(),
      }),
    ];
    if (visibleActions.length) out.push({ title: "Actions", items: visibleActions });

    return out;
  }, [index, liveHits, current, query, sync, hasRemote, onTrashDoc, trashTitle, onShowInList]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const at = Math.min(cursor, Math.max(0, flat.length - 1));
  const active = flat[at] ?? null;

  const updateQuery = useCallback((q: string) => {
    setQuery(q);
    setCursor(0);
  }, []);

  const runAction = useCallback(
    (key: PaletteActionKey) => {
      switch (key) {
        case "trashDoc":
          onTrashDoc?.();
          break;
        case "settings":
          window.location.hash = "settings";
          break;
        case "newFromClipboard":
          fire(
            api("capture:readClipboard").then((c) =>
              api("capture:openEditor", {
                body: c.text,
                frontmatter: { source: c.detectedSource },
              }),
            ),
          );
          break;
        case "newDocument":
          fire(api("window:openEditor"));
          break;
        case "pushPending":
          fire(
            api("sync:pushNow").then((after) => show(describePush(sync?.ahead ?? 0, after))),
            "Couldn’t push to GitHub",
          );
          break;
        case "pullNow":
          fire(
            api("sync:pull").then((r) =>
              show(
                describePull(r),
                r.conflicts.length && onReviewConflicts
                  ? { label: "Review", run: onReviewConflicts }
                  : undefined,
              ),
            ),
            "Couldn’t pull from GitHub",
          );
          break;
        case "reviewConflicts":
          onReviewConflicts?.();
          break;
        case "rescan":
          rescanVault();
          break;
        case "showInList": {
          const filter = listFilterFor(parseQuery(query));
          if (filter) onShowInList?.(filter);
          break;
        }
      }
    },
    [onTrashDoc, onReviewConflicts, onShowInList, query, show, sync?.ahead],
  );

  const choose = useCallback(
    (item: PaletteItem | null) => {
      if (!item) return;
      if (item.kind === "action") runAction(item.key);
      else onOpenDoc(item.doc.path);
      onClose();
    },
    [onOpenDoc, onClose, runAction],
  );

  /**
   * Takes a DOM event or React's wrapper. Moves from the row on screen — the cursor can
   * point past a list that shrank under it, and stepping from there skipped or stuck.
   * Escape is the dialog's to handle: handled here as well, one press closed the palette
   * and the sheet beneath it.
   */
  const onKeyDown = (
    e: Pick<KeyboardEvent, "key" | "preventDefault"> & { isComposing?: boolean; keyCode?: number },
  ) => {
    // Enter ending an IME composition is part of typing, not a choice.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(flat.length ? (at + 1) % flat.length : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(flat.length ? (at - 1 + flat.length) % flat.length : 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    }
  };

  return {
    query,
    /** The words typed, for showing where each result matched them. */
    words: text.split(/\s+/).filter(Boolean),
    setQuery: updateQuery,
    groups,
    flat,
    active,
    cursor,
    setCursor,
    choose,
    onKeyDown,
  };
}

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  PALETTE_MAX_DOCS,
  PALETTE_MAX_RECENT,
  PALETTE_MAX_TEXT,
  SEARCH_DEBOUNCE_MS,
} from "@/constants";
import { PALETTE_ACTIONS, type PaletteActionKey } from "@/data/palette.data";
import { PULL_FAILURE_MESSAGE, PUSH_FAILURE_MESSAGE } from "@/data/sync.data";
import { plural } from "@/helpers";
import { api, fire, rescanVault } from "@/lib/api";
import { useApp } from "@/stores/app";
import { useToast } from "@/stores/toast";
import { matchesFilters, parseQuery } from "@shared/query";
import type { DocMeta, PullResult, SearchHit, SyncStatus } from "@shared/types";
import type { PaletteGroup, PaletteItem } from "../command-palette.types";

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

/** What a pull asked for by hand did. It used to finish in silence, whatever happened. */
function describePull({ pulled, conflicts, failure }: PullResult): string {
  if (failure) return PULL_FAILURE_MESSAGE[failure];
  const base =
    pulled > 0
      ? `Pulled ${plural(pulled, "change")} from GitHub`
      : "Already up to date with GitHub";

  return conflicts.length ? `${base} · ${plural(conflicts.length, "document")} to review` : base;
}

/**
 * After "Push pending docs". The badge changes colour either way, but the palette has
 * closed and a colour is easy to miss; the action you asked for should answer.
 */
function describePush(waiting: number, { state, failure, ahead }: SyncStatus): string {
  if (failure) return PUSH_FAILURE_MESSAGE[failure];
  if (state === "offline") return PUSH_FAILURE_MESSAGE.offline;
  if (state === "pushing") return "Already pushing to GitHub";
  if (ahead > 0) return `${plural(ahead, "commit")} still waiting to push`;

  return waiting > 0
    ? `Pushed ${plural(waiting, "commit")} to GitHub`
    : "Nothing to push — GitHub is up to date";
}

/** Query → grouped results (documents · in text · actions) with keyboard navigation. */
export function useCommandPalette(
  onOpenDoc: (path: string) => void,
  onClose: () => void,
  onTrashDoc?: () => void,
  onReviewConflicts?: () => void,
  trashTitle?: string,
) {
  const index = useApp((s) => s.index);
  const sync = useApp((s) => s.sync);
  const hasRemote = useApp((s) => !!s.config?.remote);
  const show = useToast((s) => s.show);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);

  const text = parseQuery(query).text;

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    const t = setTimeout(() => {
      api("search:query", text)
        .then((h) => !cancelled && setHits(h))
        .catch(() => !cancelled && setHits([]));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text]);

  // Hits belong to the last text search; with no text the structured filters alone drive the list.
  const liveHits = useMemo(() => (text ? hits : []), [text, hits]);

  const groups = useMemo<PaletteGroup[]>(() => {
    const docs = index?.docs ?? [];
    const byPath = new Map(docs.map((d) => [d.path, d]));
    const parsed = parseQuery(query);
    const passes = (d: DocMeta) => matchesFilters(d, parsed);
    const out: PaletteGroup[] = [];

    if (parsed.text) {
      const titleHits: PaletteItem[] = [];
      const textHits: PaletteItem[] = [];
      const q = parsed.text.toLowerCase();
      for (const h of liveHits) {
        const d = byPath.get(h.path);
        if (!d || !passes(d)) continue;
        if (d.title.toLowerCase().includes(q) || d.tags.some((t) => t.includes(q)))
          titleHits.push({ kind: "doc", doc: d });
        else if (h.snippet) textHits.push({ kind: "text", doc: d, snippet: h.snippet });
        else titleHits.push({ kind: "doc", doc: d });
      }
      if (titleHits.length)
        out.push({ title: "Documents", items: titleHits.slice(0, PALETTE_MAX_DOCS) });
      if (textHits.length)
        out.push({ title: "In text", items: textHits.slice(0, PALETTE_MAX_TEXT) });
    } else {
      // Filters only (e.g. `tags:spec is:starred`) or empty → newest matching docs.
      const searching = !!query.trim();
      const filtered = docs
        .filter(passes)
        .slice(0, searching ? PALETTE_MAX_DOCS : PALETTE_MAX_RECENT);
      if (filtered.length)
        out.push({
          title: searching ? "Matching" : "Recent",
          items: filtered.map((doc) => ({ kind: "doc", doc })),
        });
    }

    const visibleActions = availableActions({
      sync,
      hasRemote,
      hasDoc: !!onTrashDoc,
      trashTitle,
      q: parsed.text.toLowerCase(),
    });
    if (visibleActions.length) out.push({ title: "Actions", items: visibleActions });

    return out;
  }, [index, liveHits, query, sync, hasRemote, onTrashDoc, trashTitle]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = flat[Math.min(cursor, Math.max(0, flat.length - 1))] ?? null;

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
      }
    },
    [onTrashDoc, onReviewConflicts, show, sync?.ahead],
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

  /** Takes a DOM event or React's wrapper: it only ever reads `key` and prevents default. */
  const onKeyDown = (e: Pick<KeyboardEvent, "key" | "preventDefault">) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return {
    query,
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

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import type { DocMeta } from "@shared/types";
import type { RowClick } from "../../document-row/document-row.types";

/** How far Page Up / Page Down move the selection. */
const PAGE = 10;
/** Letters typed within this long of each other spell one title. */
const TYPE_AHEAD_MS = 700;

/**
 * The document whose title starts with what was typed, looking from `from` onwards and
 * round. The same letter pressed again steps to the next title starting with it, the way
 * Finder does, instead of looking for a title that starts "nn".
 */
export function typeAhead(docs: DocMeta[], typed: string, from: number): number {
  const text = typed.toLowerCase();
  const repeat = text.length > 1 && [...text].every((c) => c === text[0]);
  const prefix = repeat ? text[0] : text;
  const start = repeat ? from + 1 : from;
  for (let n = 0; n < docs.length; n++) {
    const i = (start + n) % docs.length;
    if (docs[i].title.toLowerCase().startsWith(prefix)) return i;
  }

  return -1;
}

/** Where a navigation key moves the selection from `at`, or null for any other key. */
function moveTo(key: string, at: number, length: number): number | null {
  switch (key) {
    case "ArrowDown":
      return at + 1;
    case "ArrowUp":
      return at < 0 ? 0 : at - 1;
    case "Home":
      return 0;
    case "End":
      return length - 1;
    case "PageDown":
      return at + PAGE;
    case "PageUp":
      return at - PAGE;
    default:
      return null;
  }
}

/** The paths from one row to another, inclusive, in list order. */
function between(docs: DocMeta[], from: string, to: string): string[] {
  const a = docs.findIndex((d) => d.path === from);
  const b = docs.findIndex((d) => d.path === to);
  if (a < 0 || b < 0) return [to];
  const [lo, hi] = a < b ? [a, b] : [b, a];

  return docs.slice(lo, hi + 1).map((d) => d.path);
}

interface Options {
  docs: DocMeta[];
  selected: string | null;
  picked: string[];
  onSelect: (path: string) => void;
  onPick: (paths: string[]) => void;
  onOpen: (path: string) => void;
  /** Picking several at once makes sense here (not in the trash). */
  multi: boolean;
}

/**
 * One document, or several. A plain click or arrow selects one and drops the rest;
 * ⌘-click adds or removes a row, ⇧-click and ⇧-arrows take a run of them from the one in
 * the reader, which stays where the selection started. Letters jump to a title.
 */
export function useListSelection({
  docs,
  selected,
  picked,
  onSelect,
  onPick,
  onOpen,
  multi,
}: Options) {
  // The far end of a ⇧ run: the row the arrows move while the reader stays on the anchor.
  const [end, setEnd] = useState<string | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const selectOne = useCallback(
    (path: string) => {
      if (picked.length) onPick([]);
      setEnd(null);
      onSelect(path);
    },
    [picked.length, onPick, onSelect],
  );

  const activate = useCallback(
    (path: string, click: RowClick) => {
      if (multi && click.range && selected) {
        setEnd(path);
        onPick(between(docs, selected, path));

        return;
      }
      if (multi && click.toggle && selected) {
        const base = picked.length ? picked : [selected];
        const next = base.includes(path) ? base.filter((p) => p !== path) : [...base, path];
        if (next.length <= 1) {
          selectOne(next[0] ?? path);

          return;
        }
        onPick(next);
        // The reader stays on the anchor, unless that is the row just taken out.
        if (!next.includes(selected)) onSelect(next[next.length - 1]);

        return;
      }
      selectOne(path);
    },
    [multi, selected, picked, docs, onPick, onSelect, selectOne],
  );

  const extend = (step: number) => {
    const from = docs.findIndex((d) => d.path === (end ?? selected));
    const to = docs[Math.min(docs.length - 1, Math.max(0, from + step))];
    if (!to || !selected) return;
    setEnd(to.path);
    onPick(between(docs, selected, to.path));
  };

  const jump = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at < TYPE_AHEAD_MS ? t.text + key : key;
    t.at = now;
    const at = docs.findIndex((d) => d.path === selected);
    const i = typeAhead(docs, t.text, Math.max(0, at));
    if (i >= 0) selectOne(docs[i].path);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!docs.length) return;
    const at = docs.findIndex((d) => d.path === selected);
    const vertical = e.key === "ArrowDown" || e.key === "ArrowUp";
    const to = moveTo(e.key, at, docs.length);
    if (vertical && e.shiftKey && multi) {
      e.preventDefault();
      extend(e.key === "ArrowDown" ? 1 : -1);
    } else if (to !== null) {
      e.preventDefault();
      selectOne(docs[Math.min(docs.length - 1, Math.max(0, to))].path);
    } else if (e.key === "Escape" && picked.length) {
      e.preventDefault();
      selectOne(selected ?? picked[0]);
    } else if (e.key === "Enter" && selected) {
      e.preventDefault();
      onOpen(selected);
    } else if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      jump(e.key);
    }
  };

  // The row a screen reader is told about: the moving end of a run, else the selection.
  const active = picked.length && end ? end : selected;

  return { activate, onKeyDown, active };
}

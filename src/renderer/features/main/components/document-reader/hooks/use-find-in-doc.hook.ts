import { type RefObject, useCallback, useEffect, useState } from "react";
import { findRanges, isEditableTarget } from "@/helpers";

const ALL = "doc-find";
const CURRENT = "doc-find-current";

/** The browser's highlight registry, where there is one (not in the test DOM). */
function registry(): HighlightRegistry | null {
  return typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : null;
}

function clear() {
  registry()?.delete(ALL);
  registry()?.delete(CURRENT);
}

/** The open document's own scroller: the text, not the list or the sidebar around it. */
const scrollerIn = (root: RefObject<HTMLElement | null>) =>
  root.current?.querySelector<HTMLElement>("[data-doc-scroller]") ?? null;

/** Bring one match to the middle of the scroller it is in, without moving the window. */
function show(range: Range, scroller: HTMLElement | null) {
  if (!scroller) return;
  const box = scroller.getBoundingClientRect();
  const at = range.getBoundingClientRect();
  scroller.scrollTop += at.top - box.top - box.height / 2;
}

/**
 * ⌘F in the reader: every match in the open document painted, the current one brighter
 * and brought into view; Enter and ⇧Enter step through them. Only the document is
 * searched — the list and the sidebar around it are not — and nothing is written into it:
 * the matches are painted over the text, not wrapped in new elements.
 *
 * `version` changes whenever the text on screen does (another document, another view),
 * so the matches are looked for again.
 */
export function useFindInDoc(root: RefObject<HTMLElement | null>, version: string) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (!open) return;
    // After the document has painted, so the text is there to be searched.
    const frame = requestAnimationFrame(() => {
      const scroller = scrollerIn(root);
      setRanges(query && scroller ? findRanges(scroller, query) : []);
      setAt(0);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, query, version, root]);

  useEffect(() => {
    const reg = registry();
    if (!reg || !open || !ranges.length) {
      clear();

      return;
    }
    reg.set(ALL, new Highlight(...ranges));
    reg.set(CURRENT, new Highlight(ranges[at]));
    show(ranges[at], scrollerIn(root));
  }, [open, ranges, at, root]);

  useEffect(() => clear, []);

  const step = useCallback(
    (by: 1 | -1) => setAt((i) => (ranges.length ? (i + by + ranges.length) % ranges.length : 0)),
    [ranges.length],
  );
  const close = useCallback(() => {
    setOpen(false);
    clear();
  }, []);

  // ⌘F from anywhere in the library, but not over a dialog, and not from inside a
  // field that is not the find bar's own (it has its own ⌘F: select what was typed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "f" || e.shiftKey || e.altKey)
        return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isEditableTarget(e.target) && !(e.target as Element).closest?.("[data-find-bar]")) return;
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>("[data-find-bar] input")?.select(),
      );
    };
    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    open,
    query,
    setQuery,
    count: ranges.length,
    current: ranges.length ? at + 1 : 0,
    next: () => step(1),
    previous: () => step(-1),
    close,
  };
}

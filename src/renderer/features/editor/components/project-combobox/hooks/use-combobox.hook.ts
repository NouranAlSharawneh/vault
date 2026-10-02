import { useMemo, useState, type KeyboardEvent } from "react";

/**
 * Free-text combobox: pick from `options` or type a new value.
 *
 * Matches run exact, then starting with what's typed, then containing it. A match is only
 * highlighted — and taken by Enter — when it starts with what's typed: "API" typed for a
 * new project used to become "Atlas API" on Enter, because it was in there somewhere.
 */
export function useCombobox(value: string, onChange: (v: string) => void, options: string[]) {
  const [open, setOpen] = useState(false);
  // The highlighted row belongs to the query it was chosen for. It used to outlive it, so
  // after typing, Enter could point past the end of a shorter list (and do nothing) or at
  // whatever had slid into that slot.
  // Nothing arrowed to yet: the default below decides.
  const [nav, setNav] = useState<{ query: string | null; index: number }>({
    query: null,
    index: 0,
  });

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const rank = (o: string) => {
      const l = o.toLowerCase();

      return l === q ? 0 : l.startsWith(q) ? 1 : 2;
    };

    return (
      options
        .filter((o) => !q || o.toLowerCase().includes(q))
        .sort((a, b) => rank(a) - rank(b))
        // Nine, so every project the capture sheet numbers ⌘1–⌘9 can be on screen at once.
        .slice(0, 9)
    );
  }, [q, options]);

  const suggests = !q || !!matches[0]?.toLowerCase().startsWith(q);
  const cursor =
    nav.query === value
      ? Math.min(nav.index, matches.length - 1)
      : suggests && matches.length
        ? 0
        : -1;
  const move = (step: number) => {
    const n = Math.max(1, matches.length);
    setNav({ query: value, index: (Math.max(cursor, step > 0 ? -1 : 0) + step + n) % n });
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // ⌘↵ is the window's save: what's typed is the value, so let it through untouched.
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      // Nothing highlighted: keep what was typed, in an existing project's own spelling
      // when it names one — "atlas api" is Atlas API, not a second project beside it.
      const same = options.find((o) => o.toLowerCase() === q);
      pick(cursor >= 0 && matches[cursor] ? matches[cursor] : (same ?? value));
    } else if (e.key === "Escape" && open) {
      // Consume it, so the window-level Escape doesn't also close the editor.
      e.preventDefault();
      setOpen(false);
    }
  };

  return { open, setOpen, matches, cursor, pick, onKeyDown };
}

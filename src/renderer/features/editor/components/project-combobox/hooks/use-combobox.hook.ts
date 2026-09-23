import { useMemo, useState, type KeyboardEvent } from "react";

/** Free-text combobox: pick from `options` or type a new value. */
export function useCombobox(value: string, onChange: (v: string) => void, options: string[]) {
  const [open, setOpen] = useState(false);
  // The highlighted row belongs to the query it was chosen for. It used to outlive it, so
  // after typing, Enter could point past the end of a shorter list (and do nothing) or at
  // whatever had slid into that slot.
  const [nav, setNav] = useState({ query: value, index: 0 });

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();

    return options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  const cursor = nav.query === value ? Math.min(nav.index, Math.max(0, matches.length - 1)) : 0;
  const move = (step: number) => {
    const n = Math.max(1, matches.length);
    setNav({ query: value, index: (cursor + step + n) % n });
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" && open && matches[cursor]) {
      e.preventDefault();
      pick(matches[cursor]);
    } else if (e.key === "Escape" && open) {
      // Consume it, so the window-level Escape doesn't also close the editor.
      e.preventDefault();
      setOpen(false);
    }
  };

  return { open, setOpen, matches, cursor, pick, onKeyDown };
}

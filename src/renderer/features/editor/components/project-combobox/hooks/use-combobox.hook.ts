import { useMemo, useState, type KeyboardEvent } from "react";

/** Free-text combobox: pick from `options` or type a new value. */
export function useCombobox(value: string, onChange: (v: string) => void, options: string[]) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();

    return options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 8);
  }, [value, options]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => (c + 1) % Math.max(1, matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + matches.length) % Math.max(1, matches.length));
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

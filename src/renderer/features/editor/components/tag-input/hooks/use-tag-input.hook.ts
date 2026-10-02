import { useMemo, useState, type KeyboardEvent } from "react";

/** `#Some Tag` → `some-tag`: the search box reads `tags:` up to the first space. */
const clean = (t: string) => t.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-");

/** Chip input: type, Enter/comma/Tab to add, Backspace on empty to pop, arrows through suggestions. */
export function useTagInput(
  value: string[],
  onChange: (tags: string[]) => void,
  suggestions: string[],
) {
  const [text, setText] = useState("");
  // The highlighted suggestion belongs to the text it was chosen for, and resets with it.
  // It used to outlive it: Enter could then add a stale suggestion, or fall through to
  // the raw text because the index pointed past the end of a shorter list.
  const [nav, setNav] = useState({ text: "", index: 0 });

  const matches = useMemo(() => {
    const q = clean(text);
    if (!q) return [];

    // The tag exactly as typed comes first, so Enter adds it rather than a longer one.
    return suggestions
      .filter((s) => s.toLowerCase().startsWith(q) && !value.includes(s))
      .sort((a, b) => Number(b.toLowerCase() === q) - Number(a.toLowerCase() === q))
      .slice(0, 6);
  }, [text, suggestions, value]);

  const cursor = nav.text === text ? Math.min(nav.index, Math.max(0, matches.length - 1)) : 0;
  const move = (step: number) =>
    setNav({ text, index: (cursor + step + matches.length) % matches.length });

  const add = (raw: string) => {
    const t = clean(raw);
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
    setNav({ text: "", index: 0 });
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      // The window's save: keep what's typed, exactly — not a suggestion — and let it through.
      if (text) add(text);
    } else if (e.key === ",") {
      // A comma always means "this, as typed": the one way to add `api` beside `api-design`.
      e.preventDefault();
      add(text);
    } else if (e.key === "Enter" || (e.key === "Tab" && text)) {
      e.preventDefault();
      add(matches[cursor] ?? text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Escape" && text) {
      // Consume it, so the window-level Escape doesn't also close the editor.
      e.preventDefault();
      setText("");
    }
  };

  return {
    text,
    setText,
    matches,
    cursor,
    add,
    remove,
    onKeyDown,
    onBlur: () => text && add(text),
  };
}

import { useId, useRef } from "react";
import { Chip, ListRow } from "@/components/ui";
import { cx } from "@/helpers";
import { useTagInput } from "./hooks/use-tag-input.hook";
import type { TagInputProps } from "./tag-input.types";

export function TagInput({
  value,
  onChange,
  suggestions,
  dark,
  placeholder = "type to add…",
  placement = "above",
  id,
}: TagInputProps) {
  const t = useTagInput(value, onChange, suggestions);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const expanded = t.matches.length > 0;

  return (
    <div className="relative">
      <div
        // Chips sit closer to the edge than text does; with none, the placeholder starts
        // on the same column as the other fields' text.
        className={cx("field cursor-text flex-wrap gap-1 py-1", value.length ? "pl-1.5" : "")}
        // A click in the box's empty space goes to the field.
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          input.current?.focus();
        }}
      >
        {value.map((tag) => (
          <Chip
            key={tag}
            onRemove={() => {
              t.remove(tag);
              // The × goes with its chip; focus stays in the field instead of on <body>.
              input.current?.focus();
            }}
            removeLabel={`Remove ${tag}`}
          >
            #{tag}
          </Chip>
        ))}
        <input
          ref={input}
          id={id}
          className={cx(
            "min-w-20 flex-1 bg-transparent outline-none",
            dark ? "text-overlay-ink placeholder:text-overlay-ink-3" : "placeholder:text-ink-4",
          )}
          value={t.text}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => t.setText(e.target.value)}
          onKeyDown={t.onKeyDown}
          onBlur={t.onBlur}
          aria-label="Tags"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded ? `${listId}-${t.cursor}` : undefined}
        />
      </div>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Tag suggestions"
          className={cx(
            "absolute left-0 z-10 w-48 rounded-md border p-1 shadow-pop",
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            dark ? "border-overlay-line bg-overlay-2" : "border-line bg-paper",
          )}
        >
          {t.matches.map((m, i) => (
            <li key={m} role="presentation">
              <ListRow
                id={`${listId}-${i}`}
                kind="menu"
                dark={dark}
                selected={i === t.cursor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  t.add(m);
                }}
              >
                #{m}
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

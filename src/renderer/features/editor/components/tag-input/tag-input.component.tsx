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
}: TagInputProps) {
  const t = useTagInput(value, onChange, suggestions);
  return (
    <div className="relative">
      <div
        className={cx(
          "flex min-h-8 flex-wrap items-center gap-1 rounded-sm border px-1.5 py-1",
          dark
            ? "border-overlay-line bg-overlay-2"
            : "border-line bg-paper focus-within:ring-2 focus-within:ring-cherry-tint-2",
        )}
      >
        {value.map((tag) => (
          <Chip key={tag} onRemove={() => t.remove(tag)}>
            #{tag}
          </Chip>
        ))}
        <input
          className={cx(
            "min-w-20 flex-1 bg-transparent text-sm outline-none",
            dark ? "text-overlay-ink placeholder:text-overlay-ink-3" : "placeholder:text-ink-4",
          )}
          value={t.text}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => t.setText(e.target.value)}
          onKeyDown={t.onKeyDown}
          onBlur={t.onBlur}
          aria-label="tags"
        />
      </div>
      {t.matches.length > 0 && (
        <ul
          className={cx(
            "absolute bottom-full left-0 z-10 mb-1 w-48 rounded-md border p-1 shadow-pop",
            dark ? "border-overlay-line bg-overlay-2" : "border-line bg-paper",
          )}
        >
          {t.matches.map((m, i) => (
            <li key={m}>
              <ListRow
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

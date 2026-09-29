import { ChevronDown } from "lucide-react";
import { useId, useRef } from "react";
import { Dot, Kbd, ListRow } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import { cx } from "@/helpers";
import { INBOX_COLOR } from "@shared/constants";
import { projectColor, projectSlug } from "@shared/helpers";
import { useCombobox } from "./hooks/use-combobox.hook";
import type { ProjectComboboxProps } from "./project-combobox.types";

export function ProjectCombobox({
  value,
  onChange,
  projects,
  dark,
  hint,
  placement = "above",
  id,
  shortcuts = [],
}: ProjectComboboxProps) {
  const c = useCombobox(value, onChange, projects);
  const listId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const expanded = c.open && c.matches.length > 0;
  const isNew =
    value.trim() && !projects.some((p) => p.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="relative">
      {/* A click anywhere in the box — the dot, the hint, the chevron that looks like a
          button — goes to the field. The chevron used to do nothing at all. */}
      <div
        className="field cursor-text"
        onMouseDown={(e) => {
          if (e.target === input.current) return;
          e.preventDefault();
          input.current?.focus();
        }}
      >
        <Dot color={value.trim() ? projectColor(projectSlug(value)) : INBOX_COLOR} />
        <input
          ref={input}
          id={id}
          className={cx(
            "min-w-0 flex-1 bg-transparent outline-none",
            dark ? "text-overlay-ink placeholder:text-overlay-ink-3" : "placeholder:text-ink-4",
          )}
          value={value}
          placeholder="Inbox (no project)"
          onChange={(e) => {
            onChange(e.target.value);
            c.setOpen(true);
          }}
          onFocus={() => c.setOpen(true)}
          onBlur={() => setTimeout(() => c.setOpen(false), 120)}
          onKeyDown={c.onKeyDown}
          aria-label="Project"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && c.cursor >= 0 ? `${listId}-${c.cursor}` : undefined}
          // "new" and "last used" are said, not only seen.
          aria-describedby={isNew || hint ? hintId : undefined}
        />
        {isNew ? (
          <span id={hintId} className="text-2xs text-ink-4">
            new
          </span>
        ) : hint ? (
          <span id={hintId} className="text-2xs text-ink-4">
            {hint}
          </span>
        ) : null}
        <ChevronDown size={12} className="text-ink-4" />
      </div>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Projects"
          className={cx(
            "absolute left-0 z-10 w-full rounded-md border p-1 shadow-pop",
            placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
            dark ? "border-overlay-line bg-overlay-2" : "border-line bg-paper",
          )}
        >
          {c.matches.map((m, i) => {
            const n = shortcuts.indexOf(m);

            return (
              <li key={m} role="presentation">
                <ListRow
                  id={`${listId}-${i}`}
                  kind="menu"
                  dark={dark}
                  selected={i === c.cursor}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    c.pick(m);
                  }}
                >
                  <Dot color={projectColor(projectSlug(m))} /> {m}
                  {n >= 0 && n < 9 && (
                    <span className="ml-auto" aria-hidden>
                      <Kbd dark={dark}>
                        {MOD_KEY}
                        {n + 1}
                      </Kbd>
                    </span>
                  )}
                </ListRow>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

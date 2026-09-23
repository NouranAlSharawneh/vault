import { ChevronDown } from "lucide-react";
import { Dot, ListRow } from "@/components/ui";
import { cx } from "@/helpers";
import { INBOX_COLOR } from "@shared/constants";
import { projectColor, projectSlug } from "@shared/helpers";
import { useCombobox } from "./hooks/use-combobox.hook";
import type { ProjectComboboxProps } from "./project-combobox.types";

export function ProjectCombobox({ value, onChange, projects, dark, hint }: ProjectComboboxProps) {
  const c = useCombobox(value, onChange, projects);
  const isNew =
    value.trim() && !projects.some((p) => p.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="relative">
      <div
        className={cx(
          "flex h-8 items-center gap-2 rounded-sm border px-2",
          dark
            ? "border-overlay-line bg-overlay-2 focus-within:ring-2 focus-within:ring-cherry-3"
            : "border-line bg-paper focus-within:ring-2 focus-within:ring-cherry",
        )}
      >
        <Dot color={value.trim() ? projectColor(projectSlug(value)) : INBOX_COLOR} />
        <input
          className={cx(
            "min-w-0 flex-1 bg-transparent text-sm outline-none",
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
          aria-label="project"
        />
        {isNew ? (
          <span className="text-2xs text-ink-4">new</span>
        ) : hint ? (
          <span className="text-2xs text-ink-4">{hint}</span>
        ) : null}
        <ChevronDown size={12} className="text-ink-4" />
      </div>
      {c.open && c.matches.length > 0 && (
        <ul
          className={cx(
            "absolute bottom-full left-0 z-10 mb-1 w-full rounded-md border p-1 shadow-pop",
            dark ? "border-overlay-line bg-overlay-2" : "border-line bg-paper",
          )}
        >
          {c.matches.map((m, i) => (
            <li key={m}>
              <ListRow
                kind="menu"
                dark={dark}
                selected={i === c.cursor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  c.pick(m);
                }}
              >
                <Dot color={projectColor(projectSlug(m))} /> {m}
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

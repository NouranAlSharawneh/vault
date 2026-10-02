import { GitMerge, Star } from "lucide-react";
import { memo, useState, type MouseEvent } from "react";
import { Dot } from "@/components/ui";
import { cx } from "@/helpers";
import type { DocumentRowProps } from "./document-row.types";

/** Tags a row shows before it says "+N". */
const ROW_TAGS = 4;

/**
 * A click on a tag or "+N" is about that tag, not the row. Taken out of the Tab order:
 * an option's content is presentational to assistive tech, and the sidebar's tag filter
 * is the way to the same thing from the keyboard.
 */
const tagProps = (onClick: () => void) => ({
  type: "button" as const,
  tabIndex: -1,
  onClick: (e: MouseEvent) => {
    e.stopPropagation();
    onClick();
  },
  onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
});

/**
 * One document in the list: an option of the list's listbox, not a button of its own.
 * Memoised, and given only what it draws: selecting a document used to redraw every row
 * of a two-thousand-document vault.
 */
export const DocumentRow = memo(function DocumentRow({
  doc: d,
  selected,
  picked = false,
  id,
  when,
  onActivate,
  onOpen,
  onMenu,
  onTag,
}: DocumentRowProps) {
  const [allTags, setAllTags] = useState(false);
  const shown = allTags ? d.tags : d.tags.slice(0, ROW_TAGS);
  const extra = d.tags.length - shown.length;

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected || picked}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-excerpt`}
      onClick={(e) => onActivate(d.path, { toggle: e.metaKey || e.ctrlKey, range: e.shiftKey })}
      onDoubleClick={() => onOpen(d.path)}
      onContextMenu={(e) => {
        if (!onMenu) return;
        e.preventDefault();
        onMenu(d.path);
      }}
      className={cx(
        "relative block cursor-default border-b border-line/70 px-4 py-2.5 transition-colors cv-row",
        // Selected reads as selected: paper-2 against paper was 1.06:1, and hover looked the same.
        selected
          ? "bg-paper-3 group-focus-visible/list:outline-2 group-focus-visible/list:-outline-offset-2 group-focus-visible/list:outline-cherry before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-cherry"
          : picked
            ? "bg-paper-3"
            : "hover:bg-paper-2",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        {/* The title always starts at the same x; the marks sit with the time. */}
        <span id={`${id}-title`} className="truncate text-base font-medium">
          {d.title}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-2xs text-ink-4">
          {d.conflict && (
            <GitMerge
              size={10}
              className="shrink-0 text-cherry"
              role="img"
              aria-label="another version of this document"
            />
          )}
          {d.starred && (
            <Star
              size={10}
              className="shrink-0 fill-warn-2 text-warn-2"
              role="img"
              aria-label="starred"
            />
          )}
          {d.unpushed && <Dot tone="bg-warn" size={6} aria-label="not pushed yet" />}
          {when}
        </span>
      </div>
      <div id={`${id}-excerpt`} className="mt-0.5 line-clamp-2 text-xs text-ink-3">
        {d.excerpt}
      </div>
      {d.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {shown.map((t) =>
            onTag ? (
              <button
                key={t}
                {...tagProps(() => onTag(t))}
                title={`Show only #${t}`}
                className="chip chip-tag cursor-pointer transition-colors hover:bg-cherry-tint-2"
              >
                #{t}
              </button>
            ) : (
              <span key={t} className="chip chip-tag">
                #{t}
              </span>
            ),
          )}
          {extra > 0 && (
            <button
              {...tagProps(() => setAllTags(true))}
              title={d.tags
                .slice(ROW_TAGS)
                .map((t) => `#${t}`)
                .join(" ")}
              className="chip cursor-pointer transition-colors hover:bg-line"
            >
              +{extra}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

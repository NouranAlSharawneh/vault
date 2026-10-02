import { useEffect, useLayoutEffect, useRef } from "react";
import { Button, Empty } from "@/components/ui";
import { acceleratorLabel, plural } from "@/helpers";
import { useLibrary } from "@/stores/library";
import { relativeTime } from "@shared/helpers";
import type { DocMeta } from "@shared/types";
import { useNow } from "../../hooks/use-now.hook";
import { DocumentRow } from "../document-row/document-row.component";
import { ListHeader } from "../list-header/list-header.component";
import { TagFilter } from "../tag-filter/tag-filter.component";
import { SelectionBar } from "./components/selection-bar/selection-bar.component";
import type { DocumentListProps } from "./document-list.types";
import { useListSelection } from "./hooks/use-list-selection.hook";

const byCreated = (d: DocMeta) => d.created;
const NONE: string[] = [];

const rowId = (path: string) => `doc-${encodeURIComponent(path)}`;

/**
 * The document list: one listbox, one Tab stop. ↑/↓, Home/End and Page Up/Down move the
 * selection, Enter opens it in the editor, letters jump to a title, and the selected row
 * is kept in view. ⌘- and ⇧-click (and ⇧-arrows) pick several for acting on together.
 * Every row used to be its own Tab stop — two thousand of them in a big vault — with no
 * arrow keys.
 */
export function DocumentList({
  title,
  collection,
  project,
  scrollKey,
  docs,
  selected,
  onSelect,
  picked = NONE,
  onPick,
  onBulk,
  onRowMenu,
  onTag,
  onOpen,
  sort,
  onSort,
  activeTags,
  onRemoveTag,
  onClearTags,
  sortable,
  dateOf = byCreated,
  hotkey,
}: DocumentListProps) {
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const setScroll = useLibrary((s) => s.setScroll);

  // Each list starts at its top — the offset from the last one used to carry over — except
  // the list you come back to from Settings, which is where you left it.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const saved = useLibrary.getState().scroll;
    el.scrollTop = saved?.key === scrollKey ? saved.top : 0;
  }, [scrollKey]);

  const multi = !!onPick && collection !== "trash";
  const { activate, onKeyDown, active } = useListSelection({
    docs,
    selected,
    picked,
    onSelect,
    onPick: onPick ?? (() => undefined),
    onOpen,
    multi,
  });
  const pickedSet = new Set(picked);

  // Whatever selects a document from outside the list — the palette, a reveal, a trash —
  // brings its row into view. Twice: rows off screen are skipped until they scroll near
  // and stand in at an estimated height, so the first jump lands close, and the second,
  // with the real heights around it laid out, lands on it.
  useEffect(() => {
    if (!active) return;
    const reveal = () =>
      document.getElementById(rowId(active))?.scrollIntoView({ block: "nearest" });
    reveal();
    const frame = requestAnimationFrame(reveal);

    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <section className="flex h-full flex-col">
      <ListHeader
        title={title}
        count={docs.length}
        sort={sort}
        onSort={onSort}
        sortable={sortable}
      />
      <TagFilter tags={activeTags} onRemove={onRemoveTag} onClear={onClearTags} />
      {multi && picked.length > 1 && onBulk && (
        <SelectionBar
          count={picked.length}
          allStarred={docs.filter((d) => pickedSet.has(d.path)).every((d) => d.starred)}
          onBulk={onBulk}
          onClear={() => onPick?.([])}
        />
      )}
      <div
        ref={scroller}
        // The ring goes on the selected row, not round the whole list.
        className="group/list flex-1 overflow-y-auto outline-none"
        onScroll={(e) => setScroll({ key: scrollKey, top: e.currentTarget.scrollTop })}
        {...(docs.length
          ? {
              role: "listbox",
              "aria-label": title,
              "aria-multiselectable": multi || undefined,
              "data-doc-list": true,
              tabIndex: 0,
              "aria-activedescendant": active ? rowId(active) : undefined,
              onKeyDown,
            }
          : {})}
      >
        {docs.length === 0 && (
          <Empty
            title={emptyTitle(collection, activeTags)}
            hint={emptyHint(collection, project, title, activeTags, hotkey)}
            action={
              activeTags.length ? (
                <Button variant="outline" size="sm" onClick={onClearTags}>
                  Clear {plural(activeTags.length, "tag")}
                </Button>
              ) : undefined
            }
          />
        )}
        {docs.map((d) => (
          <DocumentRow
            key={d.path}
            id={rowId(d.path)}
            doc={d}
            selected={selected === d.path}
            picked={pickedSet.has(d.path)}
            when={relativeTime(dateOf(d), now)}
            onActivate={activate}
            onOpen={onOpen}
            onMenu={onRowMenu}
            onTag={onTag}
          />
        ))}
      </div>
    </section>
  );
}

function emptyTitle(collection: DocumentListProps["collection"], tags: string[]): string {
  if (tags.length) return "Nothing matches";

  return collection === "trash" ? "Trash is empty" : "Nothing here yet";
}

/**
 * Say why the list is empty, from what the list is rather than what it is called — a
 * project named "Recent" got Recent's hint. It also used to blame a filter in every case,
 * including a brand-new vault with nothing in it.
 */
function emptyHint(
  collection: DocumentListProps["collection"],
  project: string | null,
  title: string,
  tags: string[],
  hotkey?: string,
): string {
  if (tags.length) return `No documents in ${title} tagged ${tags.map((t) => `#${t}`).join(" ")}.`;
  if (project) return `Nothing in ${title} yet.`;
  if (collection === "trash") return "Deleted documents wait here until you purge them.";
  if (collection === "starred") return "Star a document from the reader to keep it here.";
  if (collection === "recent") return "Documents you open or save show up here.";
  const keys = hotkey ? acceleratorLabel(hotkey) : "the capture shortcut";

  return `Copy some markdown and press ${keys} to capture it, or press New.`;
}

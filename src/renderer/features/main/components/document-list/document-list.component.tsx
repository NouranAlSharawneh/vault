import { useCallback, useEffect, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Button, Empty } from "@/components/ui";
import { acceleratorLabel, plural } from "@/helpers";
import { useLibrary } from "@/stores/library";
import { relativeTime } from "@shared/helpers";
import type { DocMeta } from "@shared/types";
import { useNow } from "../../hooks/use-now.hook";
import { DocumentRow } from "../document-row/document-row.component";
import { ListHeader } from "../list-header/list-header.component";
import { TagFilter } from "../tag-filter/tag-filter.component";
import type { DocumentListProps } from "./document-list.types";

const byCreated = (d: DocMeta) => d.created;
/** How far Page Up / Page Down move the selection. */
const PAGE = 10;

const rowId = (path: string) => `doc-${encodeURIComponent(path)}`;

/**
 * The document list: one listbox, one Tab stop. ↑/↓, Home/End and Page Up/Down move the
 * selection, Enter opens it in the editor, and the selected row is kept in view. Every row
 * used to be its own Tab stop — two thousand of them in a big vault — with no arrow keys.
 */
export function DocumentList({
  title,
  collection,
  project,
  scrollKey,
  docs,
  selected,
  onSelect,
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

  // Whatever selects a document from outside the list — the palette, a reveal, a trash —
  // brings its row into view. Twice: rows off screen are skipped until they scroll near
  // and stand in at an estimated height, so the first jump lands close, and the second,
  // with the real heights around it laid out, lands on it.
  useEffect(() => {
    if (!selected) return;
    const reveal = () =>
      document.getElementById(rowId(selected))?.scrollIntoView({ block: "nearest" });
    reveal();
    const frame = requestAnimationFrame(reveal);

    return () => cancelAnimationFrame(frame);
  }, [selected]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!docs.length) return;
      const at = docs.findIndex((d) => d.path === selected);
      const move = (i: number) => {
        e.preventDefault();
        onSelect(docs[Math.min(docs.length - 1, Math.max(0, i))].path);
      };
      if (e.key === "ArrowDown") move(at + 1);
      else if (e.key === "ArrowUp") move(at < 0 ? 0 : at - 1);
      else if (e.key === "Home") move(0);
      else if (e.key === "End") move(docs.length - 1);
      else if (e.key === "PageDown") move(at + PAGE);
      else if (e.key === "PageUp") move(at - PAGE);
      else if (e.key === "Enter" && selected) {
        e.preventDefault();
        onOpen(selected);
      }
    },
    [docs, selected, onSelect, onOpen],
  );

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
      <div
        ref={scroller}
        // The ring goes on the selected row, not round the whole list.
        className="group/list flex-1 overflow-y-auto outline-none"
        onScroll={(e) => setScroll({ key: scrollKey, top: e.currentTarget.scrollTop })}
        {...(docs.length
          ? {
              role: "listbox",
              "aria-label": title,
              "data-doc-list": true,
              tabIndex: 0,
              "aria-activedescendant": selected ? rowId(selected) : undefined,
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
            when={relativeTime(dateOf(d), now)}
            onSelect={onSelect}
            onOpen={onOpen}
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

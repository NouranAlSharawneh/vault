import { GitMerge, Star } from "lucide-react";
import { relativeTime } from "@shared/helpers";
import { plural } from "@/helpers";
import { Button, Empty, ListRow } from "@/components/ui";
import { ListHeader } from "../list-header/list-header.component";
import { TagFilter } from "../tag-filter/tag-filter.component";
import type { DocumentListProps } from "./document-list.types";

export function DocumentList({
  title,
  docs,
  selected,
  onSelect,
  sort,
  onSort,
  activeTags,
  onRemoveTag,
  onClearTags,
  sortable,
  emptyHint,
}: DocumentListProps) {
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
      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 && (
          <Empty
            title={activeTags.length ? "Nothing matches" : "Nothing here yet"}
            hint={emptyHint ?? defaultHint(title, activeTags)}
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
          <ListRow
            key={d.path}
            kind="item"
            selected={selected === d.path}
            onClick={() => onSelect(d.path)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {d.starred && <Star size={10} className="shrink-0 fill-warn text-warn" />}
                {d.conflict && (
                  <GitMerge
                    size={10}
                    className="shrink-0 text-cherry"
                    aria-label="another version of this document"
                  />
                )}
                <span className="truncate text-base font-medium">{d.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-2xs text-ink-4">
                {d.unpushed && (
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" title="Not pushed yet" />
                )}
                {relativeTime(d.created)}
              </span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">{d.excerpt}</div>
            {d.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {d.tags.slice(0, 4).map((t) => (
                  <span key={t} className="chip chip-tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </ListRow>
        ))}
      </div>
    </section>
  );
}

/**
 * Say why the list is empty. It used to blame a filter in every case — including a
 * brand-new vault with nothing in it, and Starred with nothing starred, where there is
 * no filter to blame and the message is simply wrong.
 */
function defaultHint(title: string, tags: string[]): string {
  if (tags.length) return `No documents in ${title} tagged ${tags.map((t) => `#${t}`).join(" ")}.`;
  if (title === "Starred") return "Star a document from the reader to keep it here.";
  if (title === "Recent") return "Documents you open or save show up here.";
  if (title === "All documents") return "Capture something with the hotkey, or press New.";
  return `Nothing in ${title} yet.`;
}

import { relativeTime } from "@shared/helpers";
import { ListRow } from "@/components/ui";
import { plural } from "@/helpers";
import type { DocumentListProps } from "./document-list.types";

export function DocumentList({ docs, selected, onSelect }: DocumentListProps) {
  return (
    <section className="flex w-75 shrink-0 flex-col border-r border-line">
      <div className="flex h-12 shrink-0 items-end px-4 pb-2 text-xs text-ink-3 drag">
        {plural(docs.length, "doc")}
      </div>
      <div className="flex-1 overflow-y-auto">
        {docs.map((d) => (
          <ListRow
            key={d.path}
            kind="item"
            selected={selected === d.path}
            onClick={() => onSelect(d.path)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-base font-medium">{d.title}</span>
              <span className="shrink-0 text-2xs text-ink-4">{relativeTime(d.created)}</span>
            </div>
            <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">{d.excerpt}</div>
          </ListRow>
        ))}
      </div>
    </section>
  );
}

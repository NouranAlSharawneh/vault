import { ArrowUpDown } from "lucide-react";
import { SORT_OPTIONS } from "@/data/main.data";
import { plural } from "@/helpers";
import type { SortOrder } from "../../main.types";
import type { ListHeaderProps } from "./list-header.types";

export function ListHeader({ title, count, sort, onSort, sortable = true }: ListHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-4">
      <h2 className="truncate text-md font-semibold text-ink">{title}</h2>
      {/* Said when the list changes under a filter or a search: "Starred, 3 documents".
          The count on screen is only seen. */}
      <span role="status" className="sr-only">
        {`${title}, ${plural(count, "document")}`}
      </span>
      {count > 0 && (
        <label className="flex items-center gap-1 text-xs text-ink-4">
          <span>{count.toLocaleString()}</span>
          {sortable && <span>·</span>}
          {sortable && <ArrowUpDown size={10} />}
          <select
            hidden={!sortable}
            // h-6: a 24px target, not the 16px of its text.
            className="h-6 cursor-pointer appearance-none rounded-xs bg-transparent px-1 text-xs text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
            value={sort}
            onChange={(e) => onSort(e.target.value as SortOrder)}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

import { ArrowUpDown } from "lucide-react";
import { SORT_OPTIONS } from "@/data/main.data";
import type { SortOrder } from "../../main.types";
import type { ListHeaderProps } from "./list-header.types";

export function ListHeader({ title, count, sort, onSort, sortable = true }: ListHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-4">
      <div className="truncate text-md font-semibold text-ink">{title}</div>
      {count > 0 && (
        <label className="flex items-center gap-1 text-xs text-ink-4">
          <span>{count.toLocaleString()}</span>
          {sortable && <span>·</span>}
          {sortable && <ArrowUpDown size={10} />}
          <select
            hidden={!sortable}
            className="cursor-pointer appearance-none rounded-xs bg-transparent text-xs text-ink-3 hover:text-ink"
            value={sort}
            onChange={(e) => onSort(e.target.value as SortOrder)}
            aria-label="sort"
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

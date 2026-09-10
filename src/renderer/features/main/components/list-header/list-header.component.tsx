import { ArrowUpDown } from "lucide-react";
import { SORT_OPTIONS } from "@/data/main.data";
import type { SortOrder } from "../../main.types";
import type { ListHeaderProps } from "./list-header.types";

export function ListHeader({ title, count, sort, onSort }: ListHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between px-4">
      <div className="truncate text-md font-semibold text-ink">{title}</div>
      {count > 0 && (
        <label className="flex items-center gap-1 text-xs text-ink-4">
          <span>{count.toLocaleString()}</span>
          <span>·</span>
          <ArrowUpDown size={10} />
          <select
            className="cursor-pointer appearance-none bg-transparent text-xs text-ink-3 outline-none hover:text-ink"
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

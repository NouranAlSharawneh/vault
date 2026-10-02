import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { MOD_KEY } from "@/constants";
import type { SelectionBarProps } from "./selection-bar.types";

/**
 * What can be done to the picked documents, above the list while there are several:
 * how many, star or unstar them all, send them all to the trash, or let go.
 */
export function SelectionBar({ count, allStarred, onBulk, onClear }: SelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`${count} documents picked`}
      className="flex h-9 shrink-0 items-center gap-1 border-b border-line bg-paper-2 pr-2 pl-4 text-xs text-ink-3"
    >
      <span role="status" className="mr-1 font-medium text-ink-2">
        {count} picked
      </span>
      <Button variant="ghost" size="sm" onClick={() => onBulk(allStarred ? "unstar" : "star")}>
        <Star size={12} /> {allStarred ? "Unstar" : "Star"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onBulk("trash")}
        tooltip="Move them to the trash"
        tooltipKeys={`${MOD_KEY}⌫`}
      >
        <Trash2 size={12} /> Trash
      </Button>
      <Button variant="subtle" className="ml-auto" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

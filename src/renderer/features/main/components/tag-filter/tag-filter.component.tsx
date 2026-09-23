import { Button, Chip } from "@/components/ui";
import type { TagFilterProps } from "./tag-filter.types";

/** Active tag chips above the document list. */
export function TagFilter({ tags, onRemove, onClear }: TagFilterProps) {
  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 pb-2">
      {tags.map((t) => (
        <Chip key={t} onRemove={() => onRemove(t)}>
          #{t}
        </Chip>
      ))}
      <Button variant="subtle" onClick={onClear}>
        clear
      </Button>
    </div>
  );
}

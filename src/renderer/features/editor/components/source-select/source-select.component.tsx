import { ChevronDown } from "lucide-react";
import type { Source } from "@shared/types";
import { SOURCE_OPTIONS } from "@/data/editor.data";
import { cx } from "@/helpers";
import type { SourceSelectProps } from "./source-select.types";

export function SourceSelect({ value, onChange, dark, hint }: SourceSelectProps) {
  return (
    <div
      className={cx(
        "relative flex h-8 items-center rounded-sm border px-2",
        dark
          ? "border-overlay-line bg-overlay-2"
          : "border-line bg-paper focus-within:ring-2 focus-within:ring-cherry-tint-2",
      )}
    >
      <select
        className={cx(
          "min-w-0 flex-1 appearance-none bg-transparent text-sm outline-none",
          dark && "text-overlay-ink",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value as Source)}
        aria-label="source"
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mr-1 text-2xs text-ink-4">{hint}</span>}
      <ChevronDown size={12} className="pointer-events-none text-ink-4" />
    </div>
  );
}

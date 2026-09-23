import { ChevronDown } from "lucide-react";
import { SOURCE_OPTIONS } from "@/data/editor.data";
import { cx } from "@/helpers";
import { toSource } from "@shared/helpers";
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
      {/* The select fills the control. The hint and chevron used to be siblings beside
          it, so clicking either of them — or the gap — missed the select entirely. */}
      <select
        className={cx(
          "min-w-0 flex-1 appearance-none bg-transparent text-sm outline-none",
          hint ? "pr-16" : "pr-5",
          dark && "text-overlay-ink",
        )}
        value={value}
        onChange={(e) => onChange(toSource(e.target.value))}
        aria-label="source"
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1">
        {hint && <span className="text-2xs text-ink-4">{hint}</span>}
        <ChevronDown size={12} className="text-ink-4" />
      </div>
    </div>
  );
}

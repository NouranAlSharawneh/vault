import { cx } from "@/helpers";
import type { OptionProps } from "./option.types";

/** Selectable card row (radio-like) used by pickers. */
export function Option({ selected, onClick, badge, children }: OptionProps) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "mt-4 cursor-pointer rounded-md border px-3.5 py-3 text-base transition-colors",
        selected ? "border-cherry bg-cherry-tint" : "border-line hover:bg-paper-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">{children}</div>
        {badge && <span className="chip chip-tag">{badge}</span>}
      </div>
    </div>
  );
}

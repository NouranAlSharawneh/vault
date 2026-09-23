import type { KeyboardEvent } from "react";
import { cx } from "@/helpers";
import type { OptionProps } from "./option.types";

/**
 * Selectable card row (radio-like) used by pickers. A div rather than a button because
 * it can hold a field (the new-repo name); keys typed into that field are left alone.
 */
export function Option({ selected, onClick, badge, children }: OptionProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
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

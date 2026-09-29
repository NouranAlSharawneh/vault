import type { KeyboardEvent } from "react";
import { cx } from "@/helpers";
import type { OptionProps } from "./option.types";

/**
 * Selectable card row (radio-like) used by pickers. The radio is the card's top part; a
 * field that goes with the choice sits under it in `detail`, inside the card but not the
 * radio — a radio's children are presentational, so a field nested in one could vanish
 * for a screen reader.
 */
export function Option({ selected, onClick, badge, children, detail }: OptionProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick();
  };

  return (
    <div
      className={cx(
        "rounded-md border text-base transition-colors",
        selected ? "border-cherry bg-cherry-tint" : "border-line hover:bg-paper-2",
      )}
    >
      <div
        role="radio"
        aria-checked={selected}
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="cursor-pointer rounded-md px-3.5 py-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">{children}</div>
          {badge && <span className="chip chip-tag">{badge}</span>}
        </div>
      </div>
      {detail && <div className="-mt-1.5 px-3.5 pb-3">{detail}</div>}
    </div>
  );
}

import { X } from "lucide-react";
import { cx } from "@/helpers";
import type { ChipProps } from "./chip.types";

/** Small label. Clickable when `onClick` is given, removable when `onRemove` is given. */
export function Chip({
  children,
  tone = "tag",
  selected,
  onClick,
  onRemove,
  removeLabel = "Remove",
  title,
  className,
}: ChipProps) {
  const classes = cx(
    "chip",
    tone === "tag" && "chip-tag",
    selected && "bg-cherry text-white",
    onClick && "cursor-pointer transition-colors",
    className,
  );
  const body = (
    <>
      {children}
      {onRemove && (
        <button
          type="button"
          className="ml-0.5 opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
        >
          <X size={10} />
        </button>
      )}
    </>
  );

  return onClick ? (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      title={title}
      aria-pressed={selected}
    >
      {body}
    </button>
  ) : (
    <span className={classes} title={title}>
      {body}
    </span>
  );
}

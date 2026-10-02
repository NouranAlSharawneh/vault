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
    selected && "bg-cherry text-paper",
    // A chip you can press looks pressable: it had no hover at all.
    onClick && "cursor-pointer transition-colors",
    onClick && !selected && (tone === "tag" ? "hover:bg-cherry-tint-2" : "hover:bg-line"),
    onClick && selected && "hover:bg-cherry-2",
    onRemove && "pr-0.5",
    className,
  );
  const body = (
    <>
      {children}
      {onRemove && (
        // 16px to aim at, not the 10px glyph: the × was the smallest target in the app.
        <button
          type="button"
          className="-my-0.5 flex h-4 w-4 items-center justify-center rounded-xs opacity-60 transition-opacity hover:bg-ink/10 hover:opacity-100"
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

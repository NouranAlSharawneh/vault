import { cx } from "@/helpers";
import { useSplitDrag } from "./hooks/use-split-drag.hook";
import type { SplitPaneProps } from "./split-pane.types";

/** Two panes with a draggable vertical divider. Double-click the divider to reset. */
export function SplitPane({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.25,
  maxRatio = 0.75,
  storageKey,
  className,
}: SplitPaneProps) {
  const { ratio, dragging, container, onPointerDown, reset } = useSplitDrag({
    defaultRatio,
    minRatio,
    maxRatio,
    storageKey,
  });
  return (
    <div
      ref={container}
      className={cx("flex min-h-0 min-w-0", dragging && "cursor-col-resize select-none", className)}
    >
      <div className="flex min-h-0 min-w-0 flex-col" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        onPointerDown={onPointerDown}
        onDoubleClick={reset}
        className={cx(
          "group relative w-px shrink-0 cursor-col-resize bg-line",
          "after:absolute after:inset-y-0 after:-left-1 after:w-2 after:content-['']",
          "hover:bg-line-2",
          dragging && "bg-cherry-3",
        )}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  );
}

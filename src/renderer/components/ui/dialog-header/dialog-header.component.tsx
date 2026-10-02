import { X } from "lucide-react";
import { cx } from "@/helpers";
import { Button } from "../button/button.component";
import { SectionLabel } from "../section-label/section-label.component";
import type { DialogHeaderProps } from "./dialog-header.types";

/**
 * The band at the top of a sheet or drawer: its name on the left, Close on the right,
 * `h-11 px-4` like every pane header. The conflict sheet and the history drawer each
 * built it by hand.
 */
export function DialogHeader({
  title,
  closeLabel,
  onClose,
  children,
  className,
}: DialogHeaderProps) {
  return (
    <header className={cx("flex h-11 shrink-0 items-center justify-between gap-2 px-4", className)}>
      {/* `leading-none`: an all-caps label has no descenders, and a normal line box would
          float it above the band's middle, away from the button beside it. */}
      <SectionLabel className="leading-none">{title}</SectionLabel>
      <div className="flex items-center gap-1">
        {children}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            // Pulled out by its own padding so the icon — not the button's invisible box —
            // ends on the content's column. The hit area stays 28px.
            className="-mr-2"
            onClick={onClose}
            tooltip="Close"
            tooltipKeys="Esc"
            tooltipAlign="end"
            aria-label={closeLabel}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </header>
  );
}

import { useId } from "react";
import { cx } from "@/helpers";
import type { SettingRowProps } from "./setting-row.types";

/**
 * Label and explanation on the left, controls on the right. Every row has the same
 * minimum height and every control ends on the same right edge, which is what makes the
 * page read as one column instead of a stack of unrelated lines.
 */
export function SettingRow({
  label,
  description,
  count,
  leading,
  nested,
  children,
}: SettingRowProps) {
  const id = useId();

  // A named group: moving onto a row's control, a screen reader says which setting it
  // belongs to and reads its explanation. The label was a plain div, tied to nothing.
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      className={cx(
        "flex items-center justify-between gap-5 pr-3.5",
        // Half the page's tint: a full paper-2 read as a hole through the card to the page.
        nested ? "min-h-11 bg-paper-2/50 py-1.5 pl-7" : "min-h-13 py-2.5 pl-3.5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {leading}
        <div className="flex min-w-0 flex-col">
          <div id={`${id}-label`} className={cx("text-base text-ink", !nested && "font-medium")}>
            {label}
            {count !== undefined && (
              <span className="ml-1.5 rounded-xs bg-paper-3 px-1.5 font-mono text-xs font-normal text-ink-3">
                {count}
              </span>
            )}
          </div>
          {description && (
            <div id={`${id}-description`} className="min-w-0 text-sm text-ink-3">
              {description}
            </div>
          )}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

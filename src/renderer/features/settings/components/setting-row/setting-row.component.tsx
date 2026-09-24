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
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-5 pr-3.5",
        nested ? "min-h-11 bg-paper-2 py-1.5 pl-7" : "min-h-13 py-2.5 pl-3.5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {leading}
        <div className="flex min-w-0 flex-col">
          <div className={cx("text-base text-ink", !nested && "font-medium")}>
            {label}
            {count !== undefined && (
              <span className="ml-1.5 rounded-xs bg-paper-3 px-1.5 font-mono text-xs font-normal text-ink-3">
                {count}
              </span>
            )}
          </div>
          {description && <div className="min-w-0 text-sm text-ink-3">{description}</div>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

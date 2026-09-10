import type { SettingRowProps } from "./setting-row.types";

/** Label + explanation on the left, the control on the right. */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-base font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-sm text-ink-3">{description}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

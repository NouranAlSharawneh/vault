import { cx } from "@/helpers";
import type { SwitchProps } from "./switch.types";

/** On or off, now: a setting that takes effect the moment it is flipped. */
export function Switch({ checked, onChange, label, disabled, busy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
        checked ? "bg-cherry" : "bg-ink-4",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "size-4 rounded-full bg-paper shadow-raised transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

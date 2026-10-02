import { cx } from "@/helpers";
import type { SegmentedProps } from "./segmented.types";

/**
 * A few mutually exclusive views of one thing (Reader · Raw · Split, Rendered · Code): a
 * track with the chosen one lifted out of it. Each segment is a toggle button that says
 * whether it is pressed; there were two of these built by hand, and one said nothing.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  compact = false,
  dark = false,
  className,
}: SegmentedProps<T>) {
  return (
    // gap-0.5 matches the sidebar rows, so the chosen segment never touches a hovered one.
    <div
      role="group"
      aria-label={label}
      className={cx(
        "inline-flex gap-0.5 rounded-sm p-0.5",
        dark ? "bg-overlay-well" : "bg-paper-3",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;

        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            // Named even when only its icon shows.
            aria-label={o.label}
            title={compact ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-6 items-center rounded-xs px-2 text-xs font-medium whitespace-nowrap transition-colors",
              on
                ? dark
                  ? "bg-overlay-3 text-overlay-ink"
                  : "bg-paper text-ink shadow-raised"
                : dark
                  ? "text-overlay-ink-3 hover:text-overlay-ink"
                  : "text-ink-3 hover:text-ink",
            )}
          >
            {compact && o.icon ? (
              <>
                <span className="@md:hidden">{o.icon}</span>
                <span className="hidden @md:inline">{o.label}</span>
              </>
            ) : (
              o.label
            )}
          </button>
        );
      })}
    </div>
  );
}

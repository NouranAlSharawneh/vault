import { cx } from "@/helpers";
import type { PlaceholderProps } from "./placeholder.types";

/** Stand-in for routes that land in later milestones. */
export function Placeholder({ name, dark }: PlaceholderProps) {
  return (
    <div
      className={cx(
        "flex h-full items-center justify-center",
        dark ? "rounded-lg bg-overlay text-overlay-ink-2" : "text-ink-3",
      )}
    >
      {name} — coming in the next milestone
    </div>
  );
}

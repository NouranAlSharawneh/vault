import { Check, Lock } from "lucide-react";
import { cx } from "@/helpers";
import type { ScopeItemProps } from "./scope-item.types";

export function ScopeItem({ granted, title, description }: ScopeItemProps) {
  return (
    <li
      className={cx(
        "flex gap-3 rounded-md border px-3 py-2.5",
        granted ? "border-cherry-tint-2 bg-cherry-tint" : "border-line bg-paper-2",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
          // The lock is a shape that has to be seen: paper on line-2 was 1.4:1.
          granted ? "bg-cherry text-paper" : "bg-line text-ink-3",
        )}
      >
        {granted ? <Check size={10} strokeWidth={3} /> : <Lock size={10} />}
      </span>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs leading-snug text-ink-3">{description}</div>
      </div>
    </li>
  );
}

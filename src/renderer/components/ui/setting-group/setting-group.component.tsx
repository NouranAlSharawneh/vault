import { useId } from "react";
import { cx } from "@/helpers";
import { SectionLabel } from "../section-label/section-label.component";
import type { SettingGroupProps } from "./setting-group.types";

/**
 * One card of settings with its title above it, flush with the card's left edge. Rows
 * inside are split by hairlines, so every group has the same rhythm whatever it holds.
 */
export function SettingGroup({ title, tone = "default", children }: SettingGroupProps) {
  const danger = tone === "danger";
  const id = useId();

  // Each group's title is a heading, so VoiceOver's heading list jumps between them.
  return (
    <section className="flex flex-col gap-2" aria-labelledby={id}>
      <SectionLabel as="h2" id={id} className={cx(danger && "text-cherry")}>
        {title}
      </SectionLabel>
      <div
        className={cx(
          "divide-y divide-line overflow-hidden rounded-md border bg-paper",
          danger ? "border-cherry-tint-2" : "border-line",
        )}
      >
        {children}
      </div>
    </section>
  );
}

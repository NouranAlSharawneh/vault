import type { FeatureItemProps } from "./feature-item.types";

export function FeatureItem({ shortcut, description }: FeatureItemProps) {
  return (
    <div>
      <div className="mb-1 font-mono text-xs text-ink-2">{shortcut}</div>
      <div className="leading-snug">{description}</div>
    </div>
  );
}

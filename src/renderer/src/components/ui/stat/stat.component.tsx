import type { StatProps } from "./stat.types";

export function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-md bg-paper-2 py-3">
      <div className="font-serif text-3xl leading-none text-ink">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-ink-3">{label}</div>
    </div>
  );
}

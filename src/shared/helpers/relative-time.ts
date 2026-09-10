/** `just now`, `12m`, `3h`, `2d`, else a short date. */
export function relativeTime(input: string | number, now = Date.now()): string {
  const ts = typeof input === "number" ? input : Date.parse(input);
  if (Number.isNaN(ts)) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(d > 300 ? { year: "numeric" } : {}),
  });
}

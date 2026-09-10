/** `30d`, `2w`, `6m`, `1y`, or an ISO date. Relative values count back from `now`. */
export function parseDateish(v: string, now: number): number | null {
  const rel = /^(\d+)([dwmy])$/i.exec(v);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const day = 86_400_000;
    const span =
      unit === "d"
        ? n * day
        : unit === "w"
          ? n * 7 * day
          : unit === "m"
            ? n * 30 * day
            : n * 365 * day;
    return now - span;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/** The span a date in a query stands for: an instant for `30d`, a whole day for `2026-01-01`. */
export interface DateSpan {
  start: number;
  end: number;
  /** A count back from now (`30d`) rather than a calendar date. */
  relative: boolean;
}

const DAY = 86_400_000;

/**
 * `30d`, `2w`, `6m`, `1y`, a calendar date (`2026`, `2026-03`, `2026-03-14`) or a full
 * timestamp. Calendar dates are local days: `Date.parse("2026-01-01")` is UTC midnight,
 * so everything written in the first hours of the day, east of Greenwich, fell outside
 * `created:>2026-01-01`. A lone number (`created:>1`) is no date at all — it used to be
 * read as the year 2001.
 */
export function parseDateish(v: string, now: number): DateSpan | null {
  const rel = /^(\d+)([dwmy])$/i.exec(v);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const span = n * (unit === "d" ? 1 : unit === "w" ? 7 : unit === "m" ? 30 : 365) * DAY;
    const at = now - span;

    return { start: at, end: at, relative: true };
  }
  const cal = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(v);
  if (cal) {
    const [y, m, d] = [
      Number(cal[1]),
      cal[2] ? Number(cal[2]) - 1 : null,
      cal[3] ? Number(cal[3]) : null,
    ];
    const start = new Date(y, m ?? 0, d ?? 1).getTime();
    const next =
      d !== null
        ? new Date(y, m!, d + 1)
        : m !== null
          ? new Date(y, m + 1, 1)
          : new Date(y + 1, 0, 1);

    return { start, end: next.getTime() - 1, relative: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  const t = Date.parse(v);

  return Number.isNaN(t) ? null : { start: t, end: t, relative: false };
}

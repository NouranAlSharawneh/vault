const parse = (v: string): { core: number[]; pre: string | null } | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim());

  return m ? { core: m.slice(1, 4).map(Number), pre: m[4] ?? null } : null;
};

/**
 * Orders two semantic versions (a leading `v` is ignored): negative when `a` is older,
 * positive when newer, 0 when equal or either is unreadable.
 *
 * A prerelease sorts below its release — `0.2.0-beta.1` < `0.2.0` — and prereleases of
 * one version compare part by part. Ignoring the suffix told someone on a beta that the
 * release it was a preview of was the version they already had.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;

  return comparePre(pa.pre, pb.pre);
}

function comparePre(a: string, b: string): number {
  const xs = a.split(".");
  const ys = b.split(".");
  for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
    if (xs[i] === undefined) return -1;
    if (ys[i] === undefined) return 1;
    const [x, y] = [xs[i], ys[i]];
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }

  return 0;
}

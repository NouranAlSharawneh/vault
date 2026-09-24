const parse = (v: string): number[] | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());

  return m ? m.slice(1).map(Number) : null;
};

/**
 * Orders two `x.y.z` versions (a leading `v` and any `-beta` suffix are ignored):
 * negative when `a` is older, positive when newer, 0 when equal or either is unreadable.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];

  return 0;
}

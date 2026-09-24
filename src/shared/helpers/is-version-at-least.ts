/** Dotted numeric versions, compared part by part: `2.39.5` ≥ `2.28.0`. Missing parts are 0. */
export function isVersionAtLeast(version: string, minimum: string): boolean {
  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0;
  }

  return true;
}

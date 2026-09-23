/** The word alone, for when the count is shown somewhere else (a stat tile, a badge). */
export function pluralWord(n: number, one: string, many = one + "s"): string {
  return n === 1 ? one : many;
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n.toLocaleString()} ${pluralWord(n, one, many)}`;
}

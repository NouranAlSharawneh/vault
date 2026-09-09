export function relativeTime(iso: string | number, now = Date.now()): string {
  const ts = typeof iso === 'number' ? iso : Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  const date = new Date(ts)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d > 300 ? { year: 'numeric' } : {}) })
}

export function readTime(words: number): string {
  const m = Math.max(1, Math.round(words / 220))
  return `${m} min read`
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

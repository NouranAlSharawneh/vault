/** Turn a title or project name into a filesystem/URL safe slug. */
export function slugify(input: string): string {
  const s = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/['"’`]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, '-') // keep arabic letters
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return s.slice(0, 80).replace(/-+$/, '') || 'untitled'
}

export const INBOX_SLUG = '_inbox'

export function projectSlug(project: string | null | undefined): string {
  const p = (project ?? '').trim()
  return p ? slugify(p) : INBOX_SLUG
}

/** Pull a title from the first markdown heading, else the first non-empty line. */
export function inferTitle(body: string): string | null {
  const lines = body.split(/\r?\n/)
  for (const line of lines) {
    const m = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (m) return m[1].trim()
  }
  for (const line of lines) {
    const t = line.trim()
    if (t && !t.startsWith('```') && !t.startsWith('---')) return t.replace(/^[-*>\d.\s]+/, '').slice(0, 120)
  }
  return null
}

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g)
  return m ? m.length : 0
}

/** Deterministic colour for a project so nothing has to be stored. */
export const PROJECT_COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#ec4899', '#eab308', '#06b6d4', '#f43f5e']
export function projectColor(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return PROJECT_COLORS[h % PROJECT_COLORS.length]
}

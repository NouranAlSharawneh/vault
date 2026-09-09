import type { DocMeta, Source } from './types'

/**
 * Search grammar:
 *   project:"Atlas API"   tags:spec  tags:empty   created:>30d  created:<2026-01-01
 *   source:claude         is:starred  is:unpushed  is:orphan
 * Anything else is free text.
 */
export interface ParsedQuery {
  text: string
  project: string[]
  tags: string[]
  tagsEmpty: boolean
  source: Source[]
  starred?: boolean
  unpushed?: boolean
  orphan?: boolean
  createdAfter?: number
  createdBefore?: number
}

const TOKEN = /(\w+):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g

export function parseQuery(input: string, now = Date.now()): ParsedQuery {
  const q: ParsedQuery = { text: '', project: [], tags: [], tagsEmpty: false, source: [] }
  const words: string[] = []
  for (const m of input.matchAll(TOKEN)) {
    const [, key, quoted, bare, quotedWord, word] = m
    if (key) {
      const val = (quoted ?? bare ?? '').trim()
      applyOperator(q, key.toLowerCase(), val, now)
    } else {
      words.push(quotedWord ?? word ?? '')
    }
  }
  q.text = words.join(' ').trim()
  return q
}

function applyOperator(q: ParsedQuery, key: string, val: string, now: number): void {
  switch (key) {
    case 'project':
    case 'p':
      if (val) q.project.push(val.toLowerCase())
      break
    case 'tag':
    case 'tags':
    case 't':
      if (val.toLowerCase() === 'empty') q.tagsEmpty = true
      else if (val) q.tags.push(val.replace(/^#/, '').toLowerCase())
      break
    case 'source':
    case 'from':
      if (val) q.source.push(val.toLowerCase() as Source)
      break
    case 'is': {
      const v = val.toLowerCase()
      if (v === 'starred') q.starred = true
      else if (v === 'unpushed') q.unpushed = true
      else if (v === 'orphan' || v === 'untagged-file') q.orphan = true
      break
    }
    case 'created': {
      const m = /^([<>]=?)?(.+)$/.exec(val)
      if (!m) break
      const op = m[1] ?? '>'
      const ts = parseDateish(m[2], now)
      if (ts === null) break
      if (op.startsWith('>')) q.createdAfter = ts
      else q.createdBefore = ts
      break
    }
    default:
      // unknown operator → treat as text
      q.text = (q.text + ' ' + key + ':' + val).trim()
  }
}

/** `30d`, `2w`, `6m`, `1y`, or an ISO date. Relative values count back from `now`. */
export function parseDateish(v: string, now: number): number | null {
  const rel = /^(\d+)([dwmy])$/i.exec(v)
  if (rel) {
    const n = Number(rel[1])
    const unit = rel[2].toLowerCase()
    const day = 86_400_000
    const span = unit === 'd' ? n * day : unit === 'w' ? n * 7 * day : unit === 'm' ? n * 30 * day : n * 365 * day
    return now - span
  }
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

/** Structured filters only — free-text matching is done by the search index. */
export function matchesFilters(doc: DocMeta, q: ParsedQuery): boolean {
  if (q.project.length && !q.project.some((p) => doc.project.toLowerCase() === p || doc.projectSlug === p)) return false
  if (q.tagsEmpty && doc.tags.length) return false
  if (q.tags.length) {
    const have = doc.tags.map((t) => t.toLowerCase())
    if (!q.tags.every((t) => have.includes(t))) return false
  }
  if (q.source.length && !q.source.includes(doc.source)) return false
  if (q.starred && !doc.starred) return false
  if (q.unpushed && !doc.unpushed) return false
  if (q.orphan && !doc.orphan) return false
  if (q.createdAfter !== undefined || q.createdBefore !== undefined) {
    const t = Date.parse(doc.created)
    if (q.createdAfter !== undefined && !(t >= q.createdAfter)) return false
    if (q.createdBefore !== undefined && !(t <= q.createdBefore)) return false
  }
  return true
}

export const QUERY_OPERATORS = ['project:', 'tags:', 'created:', 'source:', 'is:'] as const

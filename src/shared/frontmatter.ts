import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { SOURCES, type Frontmatter, type Source } from './types'
import { countWords, inferTitle } from './slug'

const FM_OPEN = /^﻿?---[ \t]*\r?\n/
const FM_CLOSE = /\r?\n---[ \t]*(?:\r?\n|$)/

export interface SplitResult {
  /** Raw YAML text between the fences, or null when there is no block. */
  yaml: string | null
  body: string
}

/**
 * Split a markdown file into its frontmatter YAML and body.
 * Only looks at the head of the file — cheap enough to run on 5k files.
 */
export function splitFrontmatter(raw: string): SplitResult {
  const open = FM_OPEN.exec(raw)
  if (!open) return { yaml: null, body: raw }
  const rest = raw.slice(open[0].length)
  const close = FM_CLOSE.exec(rest)
  if (!close) return { yaml: null, body: raw }
  const yaml = rest.slice(0, close.index)
  const body = rest.slice(close.index + close[0].length)
  return { yaml, body }
}

/**
 * Read just enough of a file to get the frontmatter. Returns the byte offset
 * where the body starts so a caller streaming the file can stop early.
 */
export function frontmatterEndOffset(head: string): number | null {
  const open = FM_OPEN.exec(head)
  if (!open) return null
  const rest = head.slice(open[0].length)
  const close = FM_CLOSE.exec(rest)
  if (!close) return null
  return open[0].length + close.index + close[0].length
}

export interface ParsedDoc {
  frontmatter: Frontmatter | null
  body: string
  /** Fields present in the YAML that we don't own; preserved on write. */
  extra: Record<string, unknown>
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  return null
}

function asTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).filter((x): x is string => !!x).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
  if (typeof v === 'string') return v.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
  return []
}

function asSource(v: unknown): Source {
  const s = asString(v)?.toLowerCase()
  return (SOURCES as readonly string[]).includes(s ?? '') ? (s as Source) : 'other'
}

/** Parse a whole document. Tolerant: any YAML mess yields `frontmatter: null`. */
export function parseDoc(raw: string): ParsedDoc {
  const { yaml, body } = splitFrontmatter(raw)
  if (yaml === null) return { frontmatter: null, body, extra: {} }
  let data: unknown
  try {
    data = parseYaml(yaml)
  } catch {
    return { frontmatter: null, body, extra: {} }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { frontmatter: null, body, extra: {} }
  const d = data as Record<string, unknown>
  const title = asString(d.title) ?? inferTitle(body) ?? 'Untitled'
  const created = asString(d.created) ?? new Date(0).toISOString()
  const fm: Frontmatter = {
    title,
    project: asString(d.project) ?? '',
    tags: asTags(d.tags),
    created,
    source: asSource(d.source),
  }
  if (d.starred === true) fm.starred = true
  const extra: Record<string, unknown> = {}
  for (const k of Object.keys(d)) if (!(k in fm) && k !== 'starred') extra[k] = d[k]
  return { frontmatter: fm, body, extra }
}

/** Serialise frontmatter + body back to a file. Key order is stable so diffs stay small. */
export function composeDoc(fm: Frontmatter, body: string, extra: Record<string, unknown> = {}): string {
  const scalar = (v: unknown): string => stringifyYaml(v, { lineWidth: 0 }).trimEnd()
  const lines: string[] = [
    `title: ${scalar(fm.title)}`,
    `project: ${scalar(fm.project)}`,
    `tags: [${fm.tags.map((t) => scalar(t)).join(', ')}]`,
    `created: ${scalar(fm.created)}`,
    `source: ${fm.source}`,
  ]
  if (fm.starred) lines.push('starred: true')
  if (Object.keys(extra).length) lines.push(stringifyYaml(extra, { lineWidth: 0 }).trimEnd())
  const trimmed = body.replace(/^\s*\n/, '').replace(/\s+$/, '')
  return `---\n${lines.join('\n')}\n---\n\n${trimmed}\n`
}

export function excerptOf(body: string, max = 200): string {
  const noHeading = body.replace(/^\s*#{1,6}\s.*$/m, '')
  const text = noHeading
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`>#\[\]()!]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}

export { countWords }

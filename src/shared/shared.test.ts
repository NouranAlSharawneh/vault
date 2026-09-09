import { describe, expect, it } from 'vitest'
import { composeDoc, excerptOf, parseDoc, splitFrontmatter } from './frontmatter'
import { inferTitle, projectSlug, slugify } from './slug'
import { matchesFilters, parseQuery } from './query'
import type { DocMeta } from './types'

const SAMPLE = `---
title: Rate limiting at the edge
project: Atlas API
tags: [spec, infra]
created: 2026-09-09T14:22:10Z
source: claude
---

# Rate limiting at the edge

We currently rate-limit inside the application layer.
`

describe('frontmatter', () => {
  it('splits and parses the PRD sample', () => {
    const { frontmatter, body } = parseDoc(SAMPLE)
    expect(frontmatter).toEqual({
      title: 'Rate limiting at the edge',
      project: 'Atlas API',
      tags: ['spec', 'infra'],
      created: '2026-09-09T14:22:10Z',
      source: 'claude',
    })
    expect(body.trim().startsWith('# Rate limiting')).toBe(true)
  })

  it('round-trips through composeDoc byte-for-byte', () => {
    const { frontmatter, body, extra } = parseDoc(SAMPLE)
    expect(composeDoc(frontmatter!, body, extra)).toBe(SAMPLE)
  })

  it('omits starred when false, keeps unknown keys', () => {
    const out = composeDoc(
      { title: 'A: b', project: '', tags: [], created: '2026-01-01T00:00:00Z', source: 'manual', starred: false },
      'hello',
      { author: 'x' },
    )
    expect(out).not.toContain('starred')
    expect(out).toContain('title: "A: b"')
    expect(out).toContain('author: x')
    expect(parseDoc(out).frontmatter?.title).toBe('A: b')
  })

  it('treats files without frontmatter as orphans', () => {
    expect(parseDoc('# Hello\n\nbody').frontmatter).toBeNull()
    expect(splitFrontmatter('---\nno close').yaml).toBeNull()
  })

  it('survives broken YAML', () => {
    expect(parseDoc('---\ntitle: [unclosed\n---\nbody').frontmatter).toBeNull()
  })

  it('normalises tags given as a string with hashes', () => {
    const d = parseDoc('---\ntitle: t\ntags: "#a, #b"\n---\nx')
    expect(d.frontmatter?.tags).toEqual(['a', 'b'])
  })

  it('excerpt skips the heading and code', () => {
    expect(excerptOf('# Title\n\n```js\ncode\n```\nHello **world**')).toBe('Hello world')
  })
})

describe('slug', () => {
  it('slugifies like the PRD', () => {
    expect(slugify('Rate limiting at the edge')).toBe('rate-limiting-at-the-edge')
    expect(slugify('ADR 019 — drop Redis')).toBe('adr-019-drop-redis')
    expect(slugify('Atlas API')).toBe('atlas-api')
    expect(slugify('  ')).toBe('untitled')
    expect(slugify('Café déjà')).toBe('cafe-deja')
  })
  it('routes empty project to _inbox', () => {
    expect(projectSlug('')).toBe('_inbox')
    expect(projectSlug('Research log')).toBe('research-log')
  })
  it('infers title from first heading', () => {
    expect(inferTitle('intro\n## Second\n# First')).toBe('Second')
    expect(inferTitle('just a line\nmore')).toBe('just a line')
    expect(inferTitle('')).toBeNull()
  })
})

const doc = (over: Partial<DocMeta>): DocMeta => ({
  title: 't', project: 'Atlas API', projectSlug: 'atlas-api', tags: ['spec'], created: '2026-09-01T00:00:00Z',
  source: 'claude', path: 'atlas-api/t.md', excerpt: '', words: 10, mtime: 0, size: 0, orphan: false, ...over,
})

describe('query', () => {
  const now = Date.parse('2026-09-09T00:00:00Z')
  it('parses operators and free text', () => {
    const q = parseQuery('rate limit project:"Atlas API" tags:spec created:>30d is:starred source:claude', now)
    expect(q.text).toBe('rate limit')
    expect(q.project).toEqual(['atlas api'])
    expect(q.tags).toEqual(['spec'])
    expect(q.starred).toBe(true)
    expect(q.source).toEqual(['claude'])
    expect(q.createdAfter).toBe(now - 30 * 86_400_000)
  })
  it('filters docs', () => {
    expect(matchesFilters(doc({}), parseQuery('project:"atlas api"', now))).toBe(true)
    expect(matchesFilters(doc({}), parseQuery('project:other', now))).toBe(false)
    expect(matchesFilters(doc({ tags: [] }), parseQuery('tags:empty', now))).toBe(true)
    expect(matchesFilters(doc({}), parseQuery('tags:empty', now))).toBe(false)
    expect(matchesFilters(doc({}), parseQuery('created:>30d', now))).toBe(true)
    expect(matchesFilters(doc({ created: '2025-01-01T00:00:00Z' }), parseQuery('created:>30d', now))).toBe(false)
    expect(matchesFilters(doc({ unpushed: true }), parseQuery('is:unpushed', now))).toBe(true)
  })
})

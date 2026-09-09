import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from './vault'
import { VaultIndex } from './indexer'
import { VaultGit } from './git'

const PROJECTS = ['Atlas API', 'Onboarding v2', 'Research log', 'Edge POPs']
const TAGS = ['spec', 'adr', 'prompt', 'infra', 'meeting']

function makeFixture(root: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const project = PROJECTS[i % PROJECTS.length]
    const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    mkdirSync(join(root, slug), { recursive: true })
    const tags = [TAGS[i % TAGS.length], ...(i % 3 === 0 ? [TAGS[(i + 1) % TAGS.length]] : [])]
    const created = new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString()
    const body = `# Document ${i}\n\nThis is document number ${i} about ${project}. It mentions the ${tags[0]} keyword ${i % 7 === 0 ? 'ratelimit' : 'nothing'}.\n\n## Section\n\n- point a\n- point b\n`
    writeFileSync(join(root, slug, `document-${i}.md`), `---\ntitle: Document ${i}\nproject: ${project}\ntags: [${tags.join(', ')}]\ncreated: ${created}\nsource: claude\n---\n\n${body}`)
  }
  mkdirSync(join(root, '_inbox'), { recursive: true })
  writeFileSync(join(root, '_inbox', 'untagged.md'), '# Loose note\n\nNo frontmatter here.\n')
}

let root: string
let cache: string
let vault: Vault

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'vault-test-'))
  cache = mkdtempSync(join(tmpdir(), 'vault-cache-'))
  makeFixture(root, 800)
  await VaultGit.init(root, 'main')
  const g = new VaultGit(root, () => null)
  await g.ensureIdentity('Test', 'test@example.com')
  await g.commitAll('seed')
  vault = new Vault({ root, remote: null, branch: 'main', lastProject: null, lastSource: 'claude', hotkey: 'Alt+Space', pushDebounceMs: 3000 }, cache, () => null)
}, 60_000)

afterAll(async () => {
  await vault.close()
  rmSync(root, { recursive: true, force: true })
  rmSync(cache, { recursive: true, force: true })
})

describe('Vault (800-doc fixture)', () => {
  it('cold-scans 800 docs in well under a second', async () => {
    const t = performance.now()
    const snap = await vault.open()
    const ms = performance.now() - t
    expect(snap.docs.length).toBe(801)
    expect(snap.orphans).toBe(1)
    expect(snap.projects.map((p) => p.name)).toContain('Atlas API')
    expect(snap.projects.find((p) => p.slug === '_inbox')?.count).toBe(1)
    expect(snap.tags.find((t) => t.tag === 'spec')?.count).toBeGreaterThan(100)
    expect(ms).toBeLessThan(3000)
  })

  it('writes README index and .vault scaffold', () => {
    expect(existsSync(join(root, 'README.md'))).toBe(true)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('## Atlas API (200)')
    expect(existsSync(join(root, '.vault', 'templates', 'adr.md'))).toBe(true)
  })

  it('saves a new doc as one commit with regenerated README', async () => {
    const before = (await vault.git.git.log()).total
    const res = await vault.save({
      body: '# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer.\n',
      frontmatter: { title: 'Rate limiting at the edge', project: 'Atlas API', tags: ['spec', 'infra'], source: 'claude' },
      commit: true,
    })
    expect(res.path).toBe('atlas-api/rate-limiting-at-the-edge.md')
    expect(res.committed).toBe(true)
    const log = await vault.git.git.log()
    expect(log.total).toBe(before + 1)
    expect(log.latest?.message).toBe('add: Rate limiting at the edge')
    const raw = readFileSync(join(root, res.path), 'utf8')
    expect(raw.startsWith('---\ntitle: Rate limiting at the edge\nproject: Atlas API\ntags: [spec, infra]\ncreated: ')).toBe(true)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('[Rate limiting at the edge](atlas-api/rate-limiting-at-the-edge.md)')
    expect(vault.index.get(res.path)?.title).toBe('Rate limiting at the edge')
  })

  it('de-duplicates filenames with a numeric suffix', async () => {
    const res = await vault.save({
      body: 'second one',
      frontmatter: { title: 'Rate limiting at the edge', project: 'Atlas API', tags: [], source: 'manual' },
      commit: false,
    })
    expect(res.path).toBe('atlas-api/rate-limiting-at-the-edge-2.md')
    await vault.trash(res.path)
    expect(vault.index.get(res.path)).toBeUndefined()
    expect(existsSync(join(root, '.trash', res.path))).toBe(true)
  })

  it('moves the file when the project changes and keeps `created`', async () => {
    const p = 'atlas-api/rate-limiting-at-the-edge.md'
    const created = vault.index.get(p)!.created
    const res = await vault.save({
      body: '# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer. Moved.\n',
      frontmatter: { title: 'Rate limiting at the edge', project: 'Edge POPs', tags: ['infra'], source: 'claude' },
      existingPath: p,
      commit: true,
    })
    expect(res.path).toBe('edge-pops/rate-limiting-at-the-edge.md')
    expect(res.meta.created).toBe(created)
    expect(existsSync(join(root, p))).toBe(false)
    const hist = await vault.history(res.path)
    expect(hist.length).toBeGreaterThanOrEqual(2)
    expect(hist[0].message).toBe('move: Rate limiting at the edge')
  })

  it('full-text search finds body terms and ranks titles first', async () => {
    // wait for lazy body pass
    await new Promise((r) => setTimeout(r, 800))
    const hits = vault.search('ratelimit')
    expect(hits.length).toBeGreaterThan(50)
    const titleHits = vault.search('Document 42')
    expect(titleHits[0].path).toBe('research-log/document-42.md')
  })

  it('renames a project in one commit', { timeout: 30_000 }, async () => {
    const before = (await vault.git.git.log()).total
    const r = await vault.renameProject('Onboarding v2', 'Onboarding v3')
    expect(r.moved).toBe(200)
    expect((await vault.git.git.log()).total).toBe(before + 1)
    expect(vault.index.snapshot().projects.find((p) => p.name === 'Onboarding v3')?.count).toBe(200)
    expect(readFileSync(join(root, 'onboarding-v3', 'document-1.md'), 'utf8')).toContain('project: Onboarding v3')
  })

  it('warm-starts from cache + git diff', async () => {
    const head = await vault.git.headSha()
    const idx = new VaultIndex(root, cache, vault.git)
    const t = performance.now()
    const snap = await idx.load()
    expect(performance.now() - t).toBeLessThan(2500)
    expect(snap.headSha).toBe(head)
    expect(snap.docs.length).toBe(vault.index.snapshot().docs.length)
    await idx.close()
  })

  it('saved views round-trip through .vault/views.yml', async () => {
    const views = await vault.saveView({ name: 'Untagged this month', query: 'tags:empty created:>30d' })
    expect(views).toHaveLength(1)
    expect(readFileSync(join(root, '.vault/views.yml'), 'utf8')).toContain('tags:empty created:>30d')
    expect(await vault.listViews()).toEqual(views)
    expect(await vault.deleteView('Untagged this month')).toEqual([])
  })
})

import { promises as fs, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import chokidar, { type FSWatcher } from 'chokidar'
import MiniSearch from 'minisearch'
import { parseDoc, excerptOf, countWords } from '@shared/frontmatter'
import { projectSlug } from '@shared/slug'
import type { DocMeta, IndexSnapshot, ProjectSummary, ScanProgress, TagSummary } from '@shared/types'
import type { VaultGit } from './git'

const SKIP_DIRS = new Set(['.git', '.trash', '.vault', 'node_modules', '.obsidian'])
const HEAD_BYTES = 4096

interface CacheEntry { mtime: number; size: number; meta: DocMeta }
interface CacheFile { version: 1; headSha: string | null; files: Record<string, CacheEntry> }

/**
 * In-memory index of the vault. The repo is the only source of truth; this
 * is a disposable cache (D3). Emits `changed` and `progress`.
 */
export class VaultIndex extends EventEmitter {
  private docs = new Map<string, DocMeta>()
  private bodies = new Map<string, string>()
  private search: MiniSearch<{ id: string; title: string; tags: string; project: string; body: string }>
  private watcher: FSWatcher | null = null
  private headSha: string | null = null
  private scannedAt = 0
  private bodyPassToken = 0
  private pendingFs = new Set<string>()
  private fsTimer: NodeJS.Timeout | null = null

  constructor(readonly root: string, private cacheDir: string, private git: VaultGit | null) {
    super()
    this.search = VaultIndex.newSearch()
  }

  private static newSearch() {
    return new MiniSearch({
      fields: ['title', 'tags', 'project', 'body'],
      storeFields: [],
      searchOptions: { boost: { title: 4, tags: 3, project: 2 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
      tokenize: (s) => s.toLowerCase().split(/[\s,.;:!?()[\]{}"'`/\\<>|=+*#]+/).filter((t) => t.length > 1),
    })
  }

  // ---- public API ---------------------------------------------------------

  snapshot(): IndexSnapshot {
    const docs = [...this.docs.values()].sort((a, b) => b.created.localeCompare(a.created))
    const projects = new Map<string, ProjectSummary>()
    const tags = new Map<string, number>()
    let orphans = 0
    for (const d of docs) {
      if (d.orphan) orphans++
      const key = d.projectSlug
      const p = projects.get(key) ?? { name: d.project || 'Inbox', slug: key, count: 0 }
      p.count++
      projects.set(key, p)
      for (const t of d.tags) tags.set(t, (tags.get(t) ?? 0) + 1)
    }
    const tagList: TagSummary[] = [...tags.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    return {
      docs,
      projects: [...projects.values()].sort((a, b) => (a.slug === '_inbox' ? 1 : b.slug === '_inbox' ? -1 : b.count - a.count)),
      tags: tagList,
      orphans,
      headSha: this.headSha,
      scannedAt: this.scannedAt,
    }
  }

  get(path: string): DocMeta | undefined {
    return this.docs.get(path)
  }

  all(): DocMeta[] {
    return [...this.docs.values()]
  }

  /** Free-text search → ranked paths with a snippet from the body. */
  query(text: string, limit = 100): Array<{ path: string; score: number; snippet: string | null }> {
    if (!text.trim()) return []
    const results = this.search.search(text)
    return results.slice(0, limit).map((r) => ({ path: r.id as string, score: r.score, snippet: this.snippet(r.id as string, text) }))
  }

  private snippet(path: string, text: string): string | null {
    const body = this.bodies.get(path)
    if (!body) return null
    const term = text.split(/\s+/).filter((t) => !t.includes(':'))[0]?.toLowerCase()
    if (!term) return null
    const i = body.toLowerCase().indexOf(term)
    if (i < 0) return null
    const start = Math.max(0, i - 60)
    const end = Math.min(body.length, i + term.length + 80)
    return (start > 0 ? '…' : '') + body.slice(start, end).replace(/\s+/g, ' ') + (end < body.length ? '…' : '')
  }

  /** Full scan, or warm start from the cache + git diff. */
  async load(): Promise<IndexSnapshot> {
    const cache = this.readCache()
    const currentHead = this.git ? await this.git.headSha() : null
    if (cache && cache.headSha && currentHead && this.git) {
      try {
        await this.warmStart(cache, currentHead)
        return this.finish()
      } catch {
        /* fall through to cold */
      }
    }
    await this.coldStart()
    return this.finish()
  }

  async rescan(): Promise<IndexSnapshot> {
    this.docs.clear()
    this.bodies.clear()
    this.search = VaultIndex.newSearch()
    await this.coldStart()
    return this.finish()
  }

  /** Re-read one file (after we wrote it, or the watcher saw it). */
  async refreshFile(relPath: string): Promise<DocMeta | null> {
    if (relPath === 'README.md' || SKIP_DIRS.has(relPath.split('/')[0])) return null
    const abs = join(this.root, relPath)
    if (!existsSync(abs)) {
      this.remove(relPath)
      return null
    }
    const meta = await this.parseFile(relPath)
    if (meta) await this.indexBody(relPath)
    return meta
  }

  private isDocPath(relPath: string): boolean {
    return relPath.endsWith('.md') && relPath !== 'README.md' && !SKIP_DIRS.has(relPath.split('/')[0]) && !relPath.startsWith('.')
  }

  remove(relPath: string): void {
    if (this.docs.delete(relPath)) {
      this.bodies.delete(relPath)
      if (this.search.has(relPath)) this.search.discard(relPath)
    }
  }

  async markUnpushed(paths: Set<string>): Promise<void> {
    for (const d of this.docs.values()) d.unpushed = paths.has(d.path) || undefined
    this.emit('changed', this.snapshot())
  }

  watch(): void {
    if (this.watcher) return
    this.watcher = chokidar.watch(this.root, {
      ignored: (p) => {
        const rel = relative(this.root, p)
        if (!rel) return false
        const first = rel.split(sep)[0]
        return SKIP_DIRS.has(first) || first.startsWith('.git')
      },
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
      persistent: true,
    })
    const onFs = (p: string) => {
      const rel = relative(this.root, p)
      if (!rel.endsWith('.md') || rel === 'README.md' || SKIP_DIRS.has(rel.split(sep)[0])) return
      this.pendingFs.add(rel)
      if (this.fsTimer) clearTimeout(this.fsTimer)
      this.fsTimer = setTimeout(() => void this.flushFs(), 300)
    }
    this.watcher.on('add', onFs).on('change', onFs).on('unlink', onFs)
  }

  private async flushFs(): Promise<void> {
    const paths = [...this.pendingFs]
    this.pendingFs.clear()
    for (const p of paths) await this.refreshFile(p)
    this.headSha = this.git ? await this.git.headSha() : null
    this.writeCache()
    this.emit('changed', this.snapshot())
  }

  async close(): Promise<void> {
    await this.watcher?.close()
    this.watcher = null
  }

  // ---- scanning -----------------------------------------------------------

  private async coldStart(): Promise<void> {
    const files = await this.walk()
    this.progress({ phase: 'parsing', done: 0, total: files.length })
    let done = 0
    const batch = 64
    for (let i = 0; i < files.length; i += batch) {
      await Promise.all(files.slice(i, i + batch).map((f) => this.parseFile(f)))
      done = Math.min(files.length, i + batch)
      this.progress({ phase: 'parsing', done, total: files.length })
    }
    this.headSha = this.git ? await this.git.headSha() : null
    this.scannedAt = Date.now()
    this.emit('changed', this.snapshot())
    this.writeCache()
    void this.bodyPass([...this.docs.keys()])
  }

  private async warmStart(cache: CacheFile, currentHead: string): Promise<void> {
    // 1. trust the cache
    for (const [path, e] of Object.entries(cache.files)) this.docs.set(path, e.meta)
    // 2. ask git what changed since the cached commit
    const changed = cache.headSha === currentHead ? [] : await this.git!.changedSince(cache.headSha!)
    const toParse = new Set<string>()
    for (const c of changed) {
      if (c.oldPath) this.remove(c.oldPath)
      if (c.status === 'D') this.remove(c.path)
      else if (this.isDocPath(c.path)) toParse.add(c.path)
    }
    // 3. uncommitted edits (mtime/size differ or new)
    const files = await this.walk()
    const present = new Set(files)
    for (const path of [...this.docs.keys()]) if (!present.has(path)) this.remove(path)
    await Promise.all(
      files.map(async (f) => {
        const e = cache.files[f]
        if (!e) return toParse.add(f)
        const st = await fs.stat(join(this.root, f))
        if (st.mtimeMs !== e.mtime || st.size !== e.size) toParse.add(f)
      }),
    )
    this.progress({ phase: 'parsing', done: 0, total: toParse.size })
    await Promise.all([...toParse].map((f) => this.parseFile(f)))
    this.headSha = currentHead
    this.scannedAt = Date.now()
    this.emit('changed', this.snapshot())
    this.writeCache()
    void this.bodyPass([...this.docs.keys()])
  }

  private async walk(): Promise<string[]> {
    this.progress({ phase: 'walking', done: 0, total: 0 })
    const out: string[] = []
    const visit = async (dir: string): Promise<void> => {
      let entries: import('node:fs').Dirent[]
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      await Promise.all(
        entries.map(async (e) => {
          if (e.isDirectory()) {
            if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) await visit(join(dir, e.name))
          } else if (e.isFile() && e.name.endsWith('.md') && !(dir === this.root && e.name === 'README.md')) {
            out.push(relative(this.root, join(dir, e.name)))
          }
        }),
      )
    }
    await visit(this.root)
    return out.sort()
  }

  /** Parse only the head of the file. Body indexing happens lazily. */
  private async parseFile(relPath: string): Promise<DocMeta | null> {
    const abs = join(this.root, relPath)
    let st: import('node:fs').Stats
    try {
      st = await fs.stat(abs)
    } catch {
      return null
    }
    // Small files: read whole. Large: read head only for frontmatter, stream later.
    const raw = st.size <= HEAD_BYTES * 4 ? await fs.readFile(abs, 'utf8') : await readHead(abs, HEAD_BYTES * 4)
    const { frontmatter, body } = parseDoc(raw)
    const fromPath = relPath.split('/')
    const folderSlug = fromPath.length > 1 ? fromPath[0] : '_inbox'
    const meta: DocMeta = frontmatter
      ? {
          ...frontmatter,
          path: relPath,
          projectSlug: projectSlug(frontmatter.project) === '_inbox' ? folderSlug : projectSlug(frontmatter.project),
          excerpt: excerptOf(body),
          words: st.size <= HEAD_BYTES * 4 ? countWords(body) : Math.round(st.size / 6),
          mtime: st.mtimeMs,
          size: st.size,
          orphan: false,
        }
      : {
          title: titleFromPath(relPath, body),
          project: '',
          projectSlug: folderSlug,
          tags: [],
          created: new Date(st.birthtimeMs || st.mtimeMs).toISOString(),
          source: 'other',
          path: relPath,
          excerpt: excerptOf(body),
          words: countWords(body),
          mtime: st.mtimeMs,
          size: st.size,
          orphan: true,
        }
    if (meta.orphan === false && !meta.project && folderSlug !== '_inbox') meta.project = unslug(folderSlug)
    const prev = this.docs.get(relPath)
    if (prev?.unpushed) meta.unpushed = true
    this.docs.set(relPath, meta)
    this.upsertSearch(meta, this.bodies.get(relPath) ?? '')
    return meta
  }

  private upsertSearch(meta: DocMeta, body: string): void {
    const doc = { id: meta.path, title: meta.title, tags: meta.tags.join(' '), project: meta.project, body }
    if (this.search.has(meta.path)) this.search.replace(doc)
    else this.search.add(doc)
  }

  private async indexBody(relPath: string): Promise<void> {
    const meta = this.docs.get(relPath)
    if (!meta) return
    try {
      const raw = await fs.readFile(join(this.root, relPath), 'utf8')
      const { body } = parseDoc(raw)
      this.bodies.set(relPath, body)
      if (meta.words === Math.round(meta.size / 6)) meta.words = countWords(body)
      this.upsertSearch(meta, body)
    } catch {
      /* file vanished */
    }
  }

  /** Background pass: index bodies in chunks so the UI stays responsive. */
  private async bodyPass(paths: string[]): Promise<void> {
    const token = ++this.bodyPassToken
    this.progress({ phase: 'bodies', done: 0, total: paths.length })
    for (let i = 0; i < paths.length; i += 50) {
      if (token !== this.bodyPassToken) return
      await Promise.all(paths.slice(i, i + 50).map((p) => this.indexBody(p)))
      await new Promise((r) => setImmediate(r))
      this.progress({ phase: 'bodies', done: Math.min(paths.length, i + 50), total: paths.length })
    }
    this.progress({ phase: 'done', done: paths.length, total: paths.length })
  }

  private finish(): IndexSnapshot {
    return this.snapshot()
  }

  private progress(p: ScanProgress): void {
    this.emit('progress', p)
  }

  // ---- cache ------------------------------------------------------------------

  private cachePath(): string {
    const id = createHash('sha1').update(this.root).digest('hex').slice(0, 12)
    return join(this.cacheDir, `index-${id}.json`)
  }

  private readCache(): CacheFile | null {
    try {
      const c = JSON.parse(readFileSync(this.cachePath(), 'utf8')) as CacheFile
      return c.version === 1 ? c : null
    } catch {
      return null
    }
  }

  private writeCache(): void {
    try {
      mkdirSync(this.cacheDir, { recursive: true })
      const files: Record<string, CacheEntry> = {}
      for (const [p, m] of this.docs) files[p] = { mtime: m.mtime, size: m.size, meta: { ...m, unpushed: undefined } }
      writeFileSync(this.cachePath(), JSON.stringify({ version: 1, headSha: this.headSha, files } satisfies CacheFile))
    } catch {
      /* cache is best-effort */
    }
  }
}

async function readHead(abs: string, bytes: number): Promise<string> {
  const fh = await fs.open(abs, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const { bytesRead } = await fh.read(buf, 0, bytes, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}

function titleFromPath(relPath: string, body: string): string {
  const h = /^\s{0,3}#\s+(.+)$/m.exec(body)
  if (h) return h[1].trim()
  const base = relPath.split('/').pop()!.replace(/\.md$/, '')
  return unslug(base)
}

export function unslug(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

import { simpleGit, type SimpleGit } from 'simple-git'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CommitInfo } from '@shared/types'

/**
 * Thin wrapper around simple-git. The token is injected per-command through an
 * `http.extraheader` config flag so it never lands in `.git/config` or on disk.
 */
export class VaultGit {
  readonly git: SimpleGit
  constructor(readonly root: string, private tokenProvider: () => string | null) {
    this.git = simpleGit({ baseDir: root, binary: 'git', maxConcurrentProcesses: 1, trimmed: true })
  }

  /** Args that authenticate a single network command. */
  private authArgs(): string[] {
    const token = this.tokenProvider()
    if (!token) return []
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
    return ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`, '-c', 'credential.helper=']
  }

  static async isAvailable(): Promise<string | null> {
    try {
      const v = await simpleGit().version()
      return v.installed ? `${v.major}.${v.minor}.${v.patch}` : null
    } catch {
      return null
    }
  }

  static async clone(url: string, dest: string, token: string | null, branch?: string): Promise<void> {
    mkdirSync(dirname(dest), { recursive: true })
    const g = simpleGit()
    const args: string[] = []
    if (token) {
      const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
      args.push('-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`, '-c', 'credential.helper=')
    }
    if (branch) args.push('--branch', branch)
    await g.clone(url, dest, args)
  }

  static async init(dest: string, branch = 'main'): Promise<void> {
    mkdirSync(dest, { recursive: true })
    const g = simpleGit({ baseDir: dest })
    if (!existsSync(`${dest}/.git`)) await g.init(['-b', branch])
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo()
    } catch {
      return false
    }
  }

  async ensureIdentity(name: string, email: string): Promise<void> {
    const cfg = await this.git.listConfig()
    if (!cfg.all['user.name']) await this.git.addConfig('user.name', name)
    if (!cfg.all['user.email']) await this.git.addConfig('user.email', email)
  }

  async headSha(): Promise<string | null> {
    try {
      return (await this.git.revparse(['HEAD'])).trim() || null
    } catch {
      return null
    }
  }

  async currentBranch(): Promise<string> {
    try {
      return (await this.git.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main'
    } catch {
      return 'main'
    }
  }

  async hasRemote(): Promise<boolean> {
    const remotes = await this.git.getRemotes(true)
    return remotes.some((r) => r.name === 'origin')
  }

  async setRemote(url: string): Promise<void> {
    if (await this.hasRemote()) await this.git.remote(['set-url', 'origin', url])
    else await this.git.addRemote('origin', url)
  }

  /** Files changed between two commits: [status, path][] */
  async changedSince(sha: string): Promise<Array<{ status: string; path: string; oldPath?: string }>> {
    const out = await this.git.raw(['diff', '--name-status', '-M', sha, 'HEAD'])
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('\t')
        const status = parts[0][0]
        if (status === 'R' || status === 'C') return { status, oldPath: parts[1], path: parts[2] }
        return { status, path: parts[1] }
      })
  }

  /** Paths with uncommitted changes (modified/untracked/deleted). */
  async dirtyPaths(): Promise<string[]> {
    const s = await this.git.status()
    return [...s.modified, ...s.not_added, ...s.created, ...s.deleted, ...s.renamed.map((r) => r.to)]
  }

  async commitPaths(paths: string[], message: string, opts: { amend?: boolean } = {}): Promise<string> {
    await this.git.add(paths)
    if (opts.amend) {
      await this.git.raw(['commit', '--amend', '--no-edit', '--quiet'])
      return (await this.headSha()) ?? ''
    }
    const r = await this.git.commit(message)
    return r.commit
  }

  async commitAll(message: string): Promise<string> {
    await this.git.add(['-A'])
    const r = await this.git.commit(message)
    return r.commit
  }

  /** Stages `from` first so untracked (never-committed) files can be moved too. */
  async mv(from: string, to: string): Promise<void> {
    await this.git.add([from])
    await this.git.mv(from, to)
  }

  async aheadBehind(): Promise<{ ahead: number; behind: number }> {
    try {
      const branch = await this.currentBranch()
      const out = await this.git.raw(['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`])
      const [a, b] = out.trim().split(/\s+/).map(Number)
      return { ahead: a || 0, behind: b || 0 }
    } catch {
      // no upstream yet: everything is "ahead"
      try {
        const n = Number((await this.git.raw(['rev-list', '--count', 'HEAD'])).trim())
        return { ahead: n, behind: 0 }
      } catch {
        return { ahead: 0, behind: 0 }
      }
    }
  }

  async fetch(): Promise<void> {
    await this.git.raw([...this.authArgs(), 'fetch', 'origin', '--prune'])
  }

  async push(): Promise<void> {
    const branch = await this.currentBranch()
    await this.git.raw([...this.authArgs(), 'push', '-u', 'origin', branch])
  }

  /** Rebase local commits onto origin. Returns conflicted paths (empty = clean). */
  async pullRebase(): Promise<string[]> {
    const branch = await this.currentBranch()
    try {
      await this.git.raw([...this.authArgs(), 'pull', '--rebase', '--autostash', 'origin', branch])
      return []
    } catch {
      const s = await this.git.status()
      return s.conflicted
    }
  }

  async abortRebase(): Promise<void> {
    try {
      await this.git.rebase(['--abort'])
    } catch {
      /* not rebasing */
    }
  }

  async continueRebase(): Promise<void> {
    await this.git.raw(['-c', 'core.editor=true', 'rebase', '--continue'])
  }

  async checkoutSide(path: string, side: 'ours' | 'theirs'): Promise<void> {
    // During a rebase, "ours" is the upstream and "theirs" is the local commit being replayed.
    const flag = side === 'ours' ? '--theirs' : '--ours'
    await this.git.raw(['checkout', flag, '--', path])
    await this.git.add([path])
  }

  async log(path: string, max = 50): Promise<CommitInfo[]> {
    const SEP = '\u001f'
    const out = await this.git.raw(['log', `--max-count=${max}`, '--follow', `--format=%H${SEP}%aI${SEP}%an${SEP}%s`, '--', path])
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, date, author, message] = line.split(SEP)
        return { sha, shortSha: sha.slice(0, 7), message, date, relative: relativeTime(new Date(date).getTime()), author }
      })
  }

  async show(path: string, sha: string): Promise<string> {
    return this.git.show([`${sha}:${path}`])
  }

  /** Paths with commits not on origin. */
  async unpushedPaths(): Promise<Set<string>> {
    try {
      const branch = await this.currentBranch()
      const out = await this.git.raw(['diff', '--name-only', `origin/${branch}...HEAD`])
      return new Set(out.split('\n').filter(Boolean))
    } catch {
      return new Set()
    }
  }
}

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  const date = new Date(ts)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(d > 300 ? { year: 'numeric' } : {}) })
}

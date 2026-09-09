// Shared between main, preload and renderer. Keep this dependency-free.

export const SOURCES = ['claude', 'chatgpt', 'github', 'manual', 'other'] as const
export type Source = (typeof SOURCES)[number]

/** The frontmatter block — the entire per-document data model. */
export interface Frontmatter {
  title: string
  project: string
  tags: string[]
  created: string // ISO 8601, set once
  source: Source
  starred?: boolean
}

/** What the index knows about a document without holding its body. */
export interface DocMeta extends Frontmatter {
  /** Repo-relative path, e.g. `atlas-api/rate-limiting-at-the-edge.md` */
  path: string
  projectSlug: string
  /** First ~200 chars of body after the first heading, for list previews. */
  excerpt: string
  words: number
  mtime: number
  size: number
  /** True when the file has no (or invalid) frontmatter. Still listed, under `_inbox`. */
  orphan: boolean
  /** Set by the sync layer: file has commits not yet on the remote. */
  unpushed?: boolean
}

export interface ProjectSummary {
  name: string
  slug: string
  count: number
}

export interface TagSummary {
  tag: string
  count: number
}

export interface IndexSnapshot {
  docs: DocMeta[]
  projects: ProjectSummary[]
  tags: TagSummary[]
  orphans: number
  headSha: string | null
  scannedAt: number
}

export type ScanPhase = 'idle' | 'walking' | 'parsing' | 'bodies' | 'done'
export interface ScanProgress {
  phase: ScanPhase
  done: number
  total: number
}

export type SyncState = 'synced' | 'pending' | 'pushing' | 'offline' | 'conflict' | 'error'
export interface SyncStatus {
  state: SyncState
  ahead: number
  behind: number
  branch: string
  lastPushAt: number | null
  lastError: string | null
  remote: string | null
}

export interface GitHubUser {
  login: string
  name: string | null
  avatarUrl: string
}

export interface GitHubRepo {
  fullName: string
  name: string
  owner: string
  private: boolean
  defaultBranch: string
  cloneUrl: string
  pushedAt: string
  description: string | null
}

export interface VaultConfig {
  /** Local clone path. */
  root: string
  /** `owner/name` on GitHub, or null for a local-only vault. */
  remote: string | null
  branch: string
  /** Last-used capture defaults. */
  lastProject: string | null
  lastSource: Source
  hotkey: string
  pushDebounceMs: number
}

export interface AuthState {
  status: 'signed-out' | 'signed-in' | 'expired'
  user: GitHubUser | null
  method: 'pat' | 'device' | null
}

export interface DeviceCodeSession {
  userCode: string
  verificationUri: string
  expiresIn: number
  interval: number
}

export interface SaveRequest {
  body: string
  frontmatter: Omit<Frontmatter, 'created'> & { created?: string }
  /** When editing an existing doc, its current path. */
  existingPath?: string
  /** Commit + push, or just write to disk. */
  commit: boolean
}

export interface SaveResult {
  path: string
  meta: DocMeta
  committed: boolean
}

export interface DocContent {
  meta: DocMeta
  body: string
  raw: string
}

export interface CommitInfo {
  sha: string
  shortSha: string
  message: string
  date: string
  relative: string
  author: string
}

export interface SavedView {
  name: string
  query: string
}

export interface Template {
  name: string
  frontmatter: Partial<Frontmatter>
  body: string
}

export interface ConflictFile {
  path: string
  ours: { words: number; mtime: number }
  theirs: { words: number; mtime: number }
}

export interface ClipboardCapture {
  text: string
  words: number
  lines: number
  looksLikeMarkdown: boolean
  detectedSource: Source
  detectedTitle: string | null
}

export type AppRoute = 'onboarding' | 'main' | 'editor' | 'capture'

// Cross-process domain types shared by main, preload and renderer.
// Types that belong to one file live beside that file in a `*.types.ts`.

import type { APP_ROUTES, SOURCES } from "./constants";

export type Source = (typeof SOURCES)[number];

/** The frontmatter block — the entire per-document data model. */
export interface Frontmatter {
  title: string;
  project: string;
  tags: string[];
  /** ISO 8601, set once at first save. */
  created: string;
  source: Source;
  starred?: boolean;
}

/** What the index knows about a document without holding its body. */
export interface DocMeta extends Frontmatter {
  /** Repo-relative path, e.g. `atlas-api/rate-limiting-at-the-edge.md` */
  path: string;
  projectSlug: string;
  /** First ~200 chars of body after the first heading, for list previews. */
  excerpt: string;
  words: number;
  mtime: number;
  size: number;
  /** True when the file has no (or invalid) frontmatter. Still listed, under `_inbox`. */
  orphan: boolean;
  /** Set by the sync layer: file has commits not yet on the remote. */
  unpushed?: boolean;
}

/** A document sitting in `.trash/`, listed from disk (the index skips that folder). */
export interface TrashedDoc {
  meta: DocMeta;
  /** Path inside `.trash/`, e.g. `.trash/atlas-api/spec.md`. */
  path: string;
  /** Where it lived before, e.g. `atlas-api/spec.md`. */
  originalPath: string;
  /** ISO date of the `trash:` commit (file mtime when unknown). */
  trashedAt: string;
}

export interface DocContent {
  meta: DocMeta;
  body: string;
  raw: string;
}

/** One relative image/media path in a body, checked against a base folder. */
export interface AssetRef {
  /** As written in the markdown, e.g. `docs/hero.gif`. */
  ref: string;
  name: string;
  /** `unknown` = no base folder chosen yet, so nothing has been looked for. */
  status: "found" | "missing" | "unsupported" | "unknown";
  bytes: number;
}

/** Copy these referenced files into the vault when saving. */
export interface AssetImport {
  /** Folder the refs are relative to (the source project, usually). */
  baseDir: string;
  refs: string[];
}

export interface SaveRequest {
  body: string;
  frontmatter: Omit<Frontmatter, "created"> & { created?: string };
  /** When editing an existing doc, its current path. */
  existingPath?: string;
  /** Commit + push, or just write to disk. */
  commit: boolean;
  assets?: AssetImport;
}

export interface SaveResult {
  path: string;
  /** Repo-relative paths of assets copied in with this save. */
  assets?: string[];
  meta: DocMeta;
  committed: boolean;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
  relative: string;
  author: string;
}

export interface ProjectSummary {
  name: string;
  slug: string;
  count: number;
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface IndexSnapshot {
  docs: DocMeta[];
  projects: ProjectSummary[];
  tags: TagSummary[];
  orphans: number;
  headSha: string | null;
  scannedAt: number;
}

export type ScanPhase = "idle" | "walking" | "parsing" | "bodies" | "done";

export interface ScanProgress {
  phase: ScanPhase;
  done: number;
  total: number;
}

export interface SearchHit {
  path: string;
  score: number;
  snippet: string | null;
}

export type SyncState = "synced" | "pending" | "pushing" | "offline" | "conflict" | "error";

export interface SyncStatus {
  state: SyncState;
  ahead: number;
  behind: number;
  branch: string;
  lastPushAt: number | null;
  lastError: string | null;
  remote: string | null;
}

export interface ConflictFile {
  path: string;
  ours: { words: number; mtime: number };
  theirs: { words: number; mtime: number };
}

export type ConflictChoice = "mine" | "theirs" | "both";

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface GitHubRepo {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  pushedAt: string;
  description: string | null;
}

export interface DeviceCodeSession {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export type DevicePollStatus = "pending" | "slow_down" | "expired" | "denied" | "ok";

export type AuthMethod = "pat" | "device" | "oauth";

/** Which sign-in routes are configured on this machine. PAT is always available. */
export interface AuthMethods {
  oauth: boolean;
  device: boolean;
}

export type WebFlowStatus =
  "waiting" | "exchanging" | "ok" | "denied" | "cancelled" | "timeout" | "error";

export interface AuthState {
  status: "signed-out" | "signed-in" | "expired";
  user: GitHubUser | null;
  method: AuthMethod | null;
}

export interface VaultConfig {
  /** Local clone path. */
  root: string;
  /** `owner/name` on GitHub, or null for a local-only vault. */
  remote: string | null;
  branch: string;
  /** Last-used capture defaults. */
  lastProject: string | null;
  lastSource: Source;
  hotkey: string;
  pushDebounceMs: number;
  /** Where relative image paths resolve, remembered per project slug (this machine only). */
  assetDirs?: Record<string, string>;
}

export interface SavedView {
  name: string;
  query: string;
}

export interface Template {
  name: string;
  frontmatter: Partial<Frontmatter>;
  body: string;
}

export interface ClipboardCapture {
  text: string;
  words: number;
  lines: number;
  looksLikeMarkdown: boolean;
  detectedSource: Source;
  detectedTitle: string | null;
  /** Set when the clipboard held a markdown *file* (copied in Finder) rather than text. */
  sourcePath?: string;
}

export interface EditorDraft {
  body: string;
  frontmatter?: Partial<DocMeta>;
  /** File the text came from, so relative images can still be resolved in the editor. */
  sourcePath?: string;
}

export type AppRoute = (typeof APP_ROUTES)[number];

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
  /** Present only on the copy a sync conflict left behind. See ConflictMark. */
  conflict?: ConflictMark;
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
  /** `unknown` = nowhere to look, so nothing has been looked for. */
  status: "found" | "missing" | "unsupported" | "unknown";
  bytes: number;
}

/** What a body's relative refs turned out to be, and the folder they were read against. */
export interface AssetResolution {
  /** The folder used — the one passed in, or the one Vault worked out on its own. */
  baseDir: string | null;
  /** True when `baseDir` was found automatically rather than supplied. */
  detected: boolean;
  refs: AssetRef[];
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
  /**
   * The file's mtime when the editor loaded it. If it has moved since, something else
   * wrote the file and that version is committed before this one lands on top of it.
   */
  baseMtime?: number;
  /** Commit + push, or just write to disk. */
  commit: boolean;
  assets?: AssetImport;
}

/**
 * Text typed in the editor and not yet saved, parked in app data so a closed window, a
 * quit or a crash does not take it. `key` is the document's path, or `untitled:<id>` for
 * one that has never been saved.
 */
export interface StoredDraft {
  body: string;
  meta: Omit<Frontmatter, "created">;
  /** ISO time of the last keystroke, so a stale draft can be recognised. */
  at: string;
  /**
   * Written by the store, so main can list what was left behind. Missing on drafts
   * parked before it was recorded.
   */
  key?: string;
}

export interface SaveResult {
  path: string;
  /**
   * Set when the file had been changed outside Vault since the editor loaded it. That
   * version was committed first, so it is one entry back in the document's history.
   */
  preservedExternalEdit?: boolean;
  /** Repo-relative paths of assets copied in with this save. */
  assets?: string[];
  meta: DocMeta;
  committed: boolean;
  /**
   * False when the save left the document exactly as it was — same text, same place, and
   * (for a commit) nothing new to record. Saying "Saved" then would claim work that did
   * not happen.
   */
  changed: boolean;
}

/**
 * What an editor save did, carried to the main window with the document. The editor
 * closes the moment it saves, so the main window is the only place left to say so.
 */
export interface SavedNotice {
  title: string;
  outcome: "added" | "updated" | "moved" | "unchanged";
  committed: boolean;
  /** The file had changed elsewhere; that version is one entry back in its history. */
  keptOtherVersion: boolean;
}

/** Select a document in the main window; `saved` when an editor save is why. */
export interface DocReveal {
  path: string;
  saved?: SavedNotice;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
  relative: string;
  author: string;
  /**
   * The document's path *at that commit*. Changing a doc's project is a `git mv`, so
   * this is not always its path today — reading or restoring an old version has to use
   * the historical one or it looks up a file that did not exist yet.
   */
  path: string;
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

/**
 * Why the last push or pull failed. Carried on the status because two of these need a
 * different answer from the user: a token that is gone, and a repo that is readable but
 * not writable. As a bare message they both read "couldn't push — retry", forever.
 */
export type PushFailure = "offline" | "bad-credentials" | "no-permission" | "other";

/** Only ever about pushing. Two versions of a document is a separate fact — see `conflicts`. */
export type SyncState = "synced" | "pending" | "pushing" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  ahead: number;
  behind: number;
  branch: string;
  lastPushAt: number | null;
  lastError: string | null;
  remote: string | null;
  /**
   * Documents waiting on a decision about which version wins. Its own field rather than
   * a state, because you can be perfectly well pushed and still owe one an answer — as a
   * state it vanished the moment you typed anything.
   */
  conflicts: number;
  /** What the last failure was, so the UI can say what to do; null once a push lands. */
  failure: PushFailure | null;
}

/**
 * Stamped on the copy a conflict leaves behind, never on the document that was already
 * here. It points back at its twin, so a pair can be found again after a restart without
 * any state living outside the vault.
 */
export interface ConflictMark {
  /** Path of the document this is the other version of. */
  of: string;
  /** Where this version arrived from. Only one origin exists today. */
  from: "github";
  /** ISO date of the commit that wrote it, for "GitHub · today 14:29". */
  at: string;
}

/** Two versions of one document, waiting for you to say which one wins. */
export interface ConflictPair {
  /** The version that was already on this machine, at its original path. */
  mine: DocMeta;
  /** The copy that came down from GitHub, saved beside it. */
  theirs: DocMeta;
  mark: ConflictMark;
}

/** What a pull did, so whoever asked for it can be told. */
export interface PullResult {
  /** Every pair still waiting on a decision, including any this pull left. */
  conflicts: ConflictPair[];
  /** Commits that came down from GitHub. */
  pulled: number;
  /** Set when the pull failed; the sync status carries the message. */
  failure: PushFailure | null;
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

export type DevicePollStatus = "pending" | "slow_down" | "expired" | "denied" | "ok" | "error";

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

/** Whether the capture shortcut is actually bound, which the OS may refuse at any launch. */
export interface HotkeyStatus {
  /** The shortcut last asked for, or null before one has been. */
  accelerator: string | null;
  /** False when another app holds it (or it isn't a shortcut the OS accepts). */
  active: boolean;
}

/** Enough about the stored credential to explain a sign-out, with no secret in it. */
export interface TokenStatus {
  present: boolean;
  /** Epoch ms, or null when the token does not expire. */
  expiresAt: number | null;
  /** False means an expiry can only be resolved by authorizing again. */
  canRefresh: boolean;
}

export interface DiffLine {
  kind: "added" | "removed" | "context";
  text: string;
  /** Line number on each side; null on the side where the line does not exist. */
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffHunk {
  /** The function/section context git puts after the @@ marker, when there is one. */
  heading: string;
  lines: DiffLine[];
}

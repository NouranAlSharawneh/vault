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
  /** Fingerprint of `raw`, sent back with a save so a change made since can be noticed. */
  hash?: string;
}

/** One relative image/media path in a body, checked against a base folder. */
export interface AssetRef {
  /** As written in the markdown, e.g. `docs/hero.gif`. */
  ref: string;
  name: string;
  /**
   * `unknown` = nowhere to look, so nothing has been looked for. `outside` = it points out
   * of the folder it is relative to, and is never copied: `../../Documents/scan.pdf` in a
   * pasted README would have been committed and pushed.
   */
  status: "found" | "missing" | "unsupported" | "unknown" | "outside";
  bytes: number;
}

/** What a body's relative refs turned out to be, and the folder they were read against. */
export interface AssetResolution {
  /** The folder used — the one passed in, or the one Marasca worked out on its own. */
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
  /**
   * `DocContent.hash` of the text the editor loaded. The mtime alone cannot tell a pull
   * or a star toggle from nothing: those commit, so the file is clean again by the time
   * this save lands, and the older text went on top of them unannounced.
   */
  baseHash?: string;
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
  /** Fingerprint of the text now on disk — the next save's `baseHash`. */
  hash?: string;
  /**
   * Set when the file had been changed outside Marasca since the editor loaded it. That
   * version was committed first, so it is one entry back in the document's history.
   */
  preservedExternalEdit?: boolean;
  /** Repo-relative paths of assets copied in with this save. */
  assets?: string[];
  /**
   * The body as written, when copying images in rewrote its links (a pasted image's
   * `paste-<id>.png` became `assets/paste-<id>.png`). The editor carries on from this
   * text: kept on the old links, its next save imported the same images again.
   */
  body?: string;
  meta: DocMeta;
  committed: boolean;
  /**
   * Set when the file was written but the commit failed. The document is on disk at
   * `path`, so a retry must continue from there rather than start a new one.
   */
  commitError?: string;
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
  /** Counts up per reveal, so the event and the pull for the same one are handled once. */
  id: number;
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
export type PushFailure =
  | "offline"
  | "bad-credentials"
  | "no-permission"
  /** GitHub refused the commits themselves — a secret push protection found, a file over
   * 100 MB. Asking again sends the same commits, so it is never retried. */
  | "blocked"
  /** The repo isn't there, or this account can no longer see it. */
  | "not-found"
  | "other";

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
  /** Which way the failure was going: a failed pull is not a failed push. */
  failedOp?: "push" | "pull" | null;
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

export type AuthMethod = "pat" | "device";

/**
 * Which sign-in routes are configured on this machine. PAT is always available. There is
 * no browser-redirect (web) flow: it needs a client secret, and a secret shipped inside
 * the app is not a secret.
 */
export interface AuthMethods {
  device: boolean;
}

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
  /**
   * The same clip as markdown, converted from the HTML a browser put on the clipboard
   * beside the plain text. Only when the text itself isn't markdown and the conversion
   * has structure the text lost (headings, lists, links, tables).
   */
  converted?: string;
  /**
   * Where the clip's relative images are, when that isn't the copied file's own folder:
   * an image on the clipboard is written to a folder of its own and linked from there.
   */
  assetDir?: string;
  /** The clipboard held an image, not text: its size, for the sheet to say. */
  image?: { width: number; height: number; bytes: number };
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

/** What "Check for updates" found on the app's GitHub Releases. */
export type UpdateCheck =
  | { status: "up-to-date"; current: string; latest: string }
  | { status: "available"; current: string; latest: string; url: string }
  /** No published release to compare against (none yet, or the repo isn't public). */
  | { status: "none"; current: string };

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

/** Where the git Marasca runs came from. `path` is whatever `git` resolves to off macOS. */
export type GitSource = "apple" | "homebrew" | "macports" | "nix" | "shell" | "path" | "custom";

/**
 * Whether Marasca can run git, and if not, which fix applies. Every save is a commit, so
 * anything but `ready` means the vault can't be set up or opened.
 */
export type GitStatus =
  | { state: "ready"; version: string; binary: string; source: GitSource }
  /** No developer tools and no other git: Apple's installer is the fix. */
  | { state: "missing" }
  /** Apple's installer was started from Marasca and hasn't finished yet. */
  | { state: "installing"; startedAt: number }
  /** A developer folder is selected but has no git in it — usually after a macOS update. */
  | { state: "broken"; developerDir: string }
  /** The full Xcode app is selected and its licence hasn't been accepted. */
  | { state: "license"; binary: string }
  | { state: "too-old"; version: string; binary: string; source: GitSource }
  /** The path chosen in Settings isn't there, or isn't git. */
  | { state: "custom-invalid"; binary: string; reason: string };

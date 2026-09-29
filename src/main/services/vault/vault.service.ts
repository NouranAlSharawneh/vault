import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { promises as fs, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { GIT_IDENTITY, MTIME_SLACK_MS, README_FILE, TRASH_DIR, VAULT_DIR } from "@shared/constants";
import { composeDoc, parseDoc } from "@shared/frontmatter";
import { inferTitle, projectSlug, rewriteAssetRefs, slugify } from "@shared/helpers";
import type {
  CommitInfo,
  ConflictChoice,
  ConflictPair,
  DocContent,
  DocMeta,
  Frontmatter,
  IndexSnapshot,
  PullResult,
  SaveRequest,
  SaveResult,
  SavedView,
  SearchHit,
  SyncStatus,
  Template,
  TrashedDoc,
  VaultConfig,
} from "@shared/types";
import { importAssets } from "../assets";
import { assertInside, freeRelPath } from "../fs/paths";
import { GitService } from "../git/git.service";
import { IndexerService } from "../indexer/indexer.service";
import { conflicts, resolveConflict } from "./conflicts";
import { atCommit, diff, history } from "./history";
import { projects, renameProject } from "./projects";
import { commitWithReadme, writeReadme } from "./readme";
import { SyncEngine } from "./sync.service";
import { listTrash, purgeTrash, readTrashed, restoreFromTrash } from "./trash";
import type { ExistingDoc, TokenProvider } from "./vault.types";
import { ViewsStore } from "./views";

const ADR_TEMPLATE =
  "---\ntitle: ADR\ntags: [adr]\nsource: manual\n---\n# ADR NNN — Title\n\n## Context\n\n## Decision\n\n## Consequences\n";

/**
 * Everything that touches the vault folder: save, trash, rename, history,
 * views, templates, and the commit → debounced push pipeline.
 * Emits `index`, `progress`, `sync`, `auth-ok`, `auth-suspect`.
 */
export class VaultService extends EventEmitter {
  readonly git: GitService;
  private readonly syncEngine: SyncEngine;
  readonly index: IndexerService;
  private readonly views: ViewsStore;

  constructor(
    readonly config: VaultConfig,
    cacheDir: string,
    tokenProvider: TokenProvider,
    /**
     * Renew an expiring token before we use it. Without this the first push after the
     * token's deadline always fails in the user's face before recovery kicks in, because
     * the only other refresh happens at startup.
     */
    freshenToken: () => Promise<void> = async () => undefined,
  ) {
    super();
    this.git = new GitService(config.root, tokenProvider);
    this.index = new IndexerService(config.root, cacheDir, this.git);
    this.index.on("changed", (s: IndexSnapshot) => this.emit("index", s));
    this.index.on("progress", (p) => this.emit("progress", p));
    this.syncEngine = new SyncEngine(this, tokenProvider, freshenToken);
    this.views = new ViewsStore(config.root, this.git, () => this.schedulePush());
  }

  get root(): string {
    return this.config.root;
  }

  async open(): Promise<IndexSnapshot> {
    await fs.mkdir(this.root, { recursive: true });
    if (!(await this.git.isRepo())) await GitService.init(this.root, this.config.branch);
    await this.git.clearStaleLock();
    await this.git.ensureIdentity(GIT_IDENTITY.name, GIT_IDENTITY.email);
    await this.ensureScaffold();
    const snap = await this.index.load();
    if (!existsSync(join(this.root, README_FILE))) await this.writeReadme();
    this.index.watch();
    this.syncEngine.start(await this.git.currentBranch(), this.config.remote);

    return snap;
  }

  async close(): Promise<void> {
    this.syncEngine.stop();
    // Let a save or a push already under way finish, so a quit or a reopen never cuts a
    // commit in half — but not for ever: a network call can hang.
    await Promise.race([this.git.exclusive(async () => undefined), delay(CLOSE_WAIT_MS)]);
    await this.index.close();
    this.removeAllListeners();
  }

  /** Push what is waiting, for a quit. */
  async flush(): Promise<void> {
    await this.syncEngine.flush();
  }

  private async ensureScaffold(): Promise<void> {
    const templates = join(this.root, VAULT_DIR, "templates");
    await fs.mkdir(templates, { recursive: true });
    const gi = join(this.root, ".gitignore");
    if (!existsSync(gi)) await fs.writeFile(gi, ".DS_Store\n.obsidian/workspace*\n");
    if (!existsSync(join(templates, "adr.md")))
      await fs.writeFile(join(templates, "adr.md"), ADR_TEMPLATE);
  }

  // ---- docs ---------------------------------------------------------------------

  async read(relPath: string): Promise<DocContent> {
    const raw = await fs.readFile(assertInside(this.root, relPath), "utf8");
    const { body } = parseDoc(raw);
    // Read afresh with the text rather than from the index, which trails the disk by the
    // watcher's debounce: the editor loaded the new body with the old tags, and its save
    // wrote the old tags back.
    const meta = (await this.index.refreshFile(relPath)) ?? this.index.get(relPath);
    if (!meta) throw new Error(`Not in index: ${relPath}`);

    return { meta, body, raw, hash: fingerprint(raw) };
  }

  pathFor(project: string, title: string): string {
    return `${projectSlug(project)}/${slugify(title)}.md`;
  }

  /** Path preview for the editor footer: where a save would really land, `-2` and all. */
  previewPath(project: string, title: string, existingPath?: string): string {
    return this.targetFor(project, title || "untitled", existingPath);
  }

  /**
   * Where a document with this project and title belongs. One that lives outside its
   * project's folder — nested in `research/2024/`, or at the vault root — stays where it
   * is unless its title or project really changed: the first save of such a note, or
   * starring it, used to move it into the canonical folder.
   */
  private targetFor(project: string, title: string, existingPath?: string): string {
    const wanted = this.pathFor(project, title);
    const prior = existingPath ? this.index.get(existingPath) : undefined;
    if (
      existingPath &&
      prior &&
      folderOf(existingPath) !== folderOf(wanted) &&
      projectSlug(project) === prior.projectSlug &&
      slugify(title) === slugify(prior.title)
    )
      return existingPath;

    return this.uniquePath(wanted, existingPath);
  }

  /** The wanted path, or the next free `-2` variant of it. Part of VaultContext. */
  uniquePath(wanted: string, keep?: string): string {
    return freeRelPath(this.root, wanted, keep);
  }

  /**
   * The save path from the PRD: compose frontmatter → write → commit → regenerate
   * README into the same commit → update index → schedule push.
   */
  async save(req: SaveRequest): Promise<SaveResult> {
    return this.git.exclusive(() => this.saveNow(req));
  }

  /** `save`, for callers already holding the repo. */
  private async saveNow(req: SaveRequest): Promise<SaveResult> {
    if (req.existingPath) assertInside(this.root, req.existingPath);
    await this.leaveStaleRebase();
    const title = (req.frontmatter.title || inferTitle(req.body) || "Untitled").trim();
    const existing = await this.readExisting(req);
    const { before, extra } = existing;
    const fm = frontmatterFor(req, title, existing);

    const target = this.targetFor(fm.project, fm.title, req.existingPath);
    const abs = join(this.root, target);
    await fs.mkdir(dirname(abs), { recursive: true });

    // Something else wrote this file while it was open here — another editor, a pull, a
    // second Marasca window. Its version is committed before ours lands on top, so it is
    // one entry back in the history drawer rather than gone. We do not refuse the save:
    // the user is mid-thought, and their text is the one thing that must not be lost.
    const preservedExternalEdit = await this.preserveExternalEdit(req, title, before);

    const isNew = !req.existingPath;
    const moved = !!req.existingPath && req.existingPath !== target;
    if (moved) await this.moveForSave(req.existingPath!, target, req.commit);

    let body = req.body;
    let assets: string[] = [];
    if (req.assets?.refs.length) {
      const imported = await importAssets(this.root, dirname(target), req.assets);
      body = rewriteAssetRefs(body, imported.map);
      assets = imported.paths;
    }
    const text = composeDoc(fm, body, extra);
    const rewritten = moved || assets.length > 0 || text !== before;
    await fs.writeFile(abs, text);

    const meta = (await this.index.refreshFile(target))!;
    if (moved) this.index.remove(req.existingPath!);

    const verb = isNew ? "add" : moved ? "move" : "update";
    const { committed, commitError } = req.commit
      ? await this.tryCommitSave([target, ...assets], `${verb}: ${title}`)
      : { committed: false, commitError: undefined };
    this.emit("index", this.index.snapshot());
    // A commit that found nothing staged means the file already read this way in git —
    // even if an earlier local-only save had changed it, that is what was just recorded.
    const changed = req.commit && !commitError ? committed : rewritten;

    return {
      path: target,
      hash: fingerprint(text),
      meta,
      committed,
      changed,
      assets,
      preservedExternalEdit,
      ...(commitError ? { commitError } : {}),
    };
  }

  /**
   * Move the file a save is renaming. A missing source is not an error — it was trashed,
   * renamed in Finder or removed by a pull while the editor had it open, and the new text
   * is about to be written at the target anyway; asking git to move it failed with "bad
   * source", every time, until the window was closed. A save that won't commit moves the
   * file without staging anything, so the rename can't ride along in some later commit.
   */
  private async moveForSave(from: string, to: string, commit: boolean): Promise<void> {
    if (!existsSync(join(this.root, from))) return;
    if (commit) await this.git.mv(from, to);
    else await fs.rename(join(this.root, from), join(this.root, to));
  }

  /**
   * A rebase left over from a crash, with nothing of ours in it yet: committing onto its
   * detached HEAD is how saves used to vanish. The branch it would restore holds every
   * commit made before it started, and the next pull redoes it properly.
   */
  private async leaveStaleRebase(): Promise<void> {
    if (this.git.rebaseInProgress()) await this.git.abortRebase();
  }

  /**
   * The file a save is about to replace, as it reads now (null for a new document), with
   * what the save keeps from it: its created date and any frontmatter Marasca doesn't own.
   */
  private async readExisting(req: SaveRequest): Promise<ExistingDoc> {
    const path = req.existingPath;
    if (!path || !existsSync(join(this.root, path))) {
      return { before: null, created: req.frontmatter.created, extra: {}, starred: undefined };
    }
    const before = await fs.readFile(join(this.root, path), "utf8");
    const prev = parseDoc(before);
    // Starring is a commit of its own, made from the main window while an editor may have
    // this document open with the old flag. When the file moved on since the editor
    // loaded it, the file's star is the newer one.
    const movedOn = !!req.baseHash && fingerprint(before) !== req.baseHash;

    return {
      before,
      created: req.frontmatter.created || prev.frontmatter?.created,
      extra: prev.extra,
      starred: movedOn ? !!prev.frontmatter?.starred : undefined,
    };
  }

  /**
   * The file is written. If the commit fails now, the caller still has to learn where it
   * went: before, it kept the old path, so a retry wrote a `-2` copy beside a new doc, or
   * asked git to move a renamed one from a path that was already empty.
   */
  private async tryCommitSave(
    paths: string[],
    message: string,
  ): Promise<{ committed: boolean; commitError: string | undefined }> {
    try {
      return { committed: await this.commitSave(paths, message), commitError: undefined };
    } catch (e) {
      return { committed: false, commitError: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Commit a save and queue its push. False when git found nothing new to record. */
  private async commitSave(paths: string[], message: string): Promise<boolean> {
    const committed = await commitWithReadme(this, paths, message);
    if (committed) this.schedulePush();

    return committed;
  }

  /**
   * Commit whatever is on disk before overwriting it, when the file has changed since the
   * editor loaded it. Returns true only when there was a real change to keep — a touched
   * file with identical contents stages nothing, and an empty commit is not worth making.
   */
  private async preserveExternalEdit(
    req: SaveRequest,
    title: string,
    before: string | null,
  ): Promise<boolean> {
    // A save that won't commit has nothing to commit the other version with — and saying
    // "kept in history" would be untrue. That text stays in the file's own history.
    if (!req.commit || !req.existingPath || before === null) return false;
    if (req.baseHash) {
      if (fingerprint(before) === req.baseHash) return false;
    } else {
      if (!req.baseMtime) return false;
      const { mtimeMs } = await fs.stat(join(this.root, req.existingPath));
      // Filesystems round mtimes differently; only a clearly later write counts.
      if (mtimeMs <= req.baseMtime + MTIME_SLACK_MS) return false;
    }
    const uncommitted = (await this.git.git.status()).files.some(
      (f) => f.path === req.existingPath,
    );
    // Committed already — a pull brought it, or a star toggle wrote it. It is in history,
    // so nothing needs keeping; but the save is still landing on top of a version the
    // editor never saw, and that is said rather than done quietly.
    if (uncommitted) await this.git.commitPaths([req.existingPath], `external: ${title}`);

    return true;
  }

  async setStarred(relPath: string, starred: boolean): Promise<DocMeta> {
    return this.git.exclusive(async () => {
      const { body, meta } = await this.read(relPath);
      const res = await this.saveNow({
        body,
        frontmatter: { ...pickFrontmatter(meta), starred },
        existingPath: relPath,
        commit: true,
      });

      return res.meta;
    });
  }

  /** PRD Q5: move to `.trash/` (scanner skips it) rather than `git rm`. */
  async trash(relPath: string): Promise<TrashedDoc> {
    return this.git.exclusive(() => this.trashNow(relPath));
  }

  private async trashNow(relPath: string): Promise<TrashedDoc> {
    assertInside(this.root, relPath);
    await this.leaveStaleRebase();
    const dest = this.uniquePath(`${TRASH_DIR}/${relPath}`);
    await fs.mkdir(dirname(join(this.root, dest)), { recursive: true });
    const meta = this.index.get(relPath) ?? (await this.index.readMeta(relPath));
    if (!meta) throw new Error(`Not a document: ${relPath}`);
    await this.git.mv(relPath, dest);
    this.index.remove(relPath);
    await commitWithReadme(this, [dest], `trash: ${meta.title}`);
    this.schedulePush();
    this.emit("index", this.index.snapshot());

    return {
      meta: { ...meta, path: dest },
      path: dest,
      originalPath: relPath,
      trashedAt: new Date().toISOString(),
    };
  }

  // ---- trash --------------------------------------------------------------------

  async listTrash(): Promise<TrashedDoc[]> {
    return listTrash(this);
  }

  async readTrashed(path: string): Promise<DocContent> {
    return readTrashed(this, path);
  }

  async restoreFromTrash(path: string): Promise<SaveResult> {
    return this.git.exclusive(() => restoreFromTrash(this, path));
  }

  async purgeTrash(path?: string): Promise<{ removed: number; assets: string[] }> {
    return this.git.exclusive(() => purgeTrash(this, path));
  }

  // ---- history ------------------------------------------------------------------

  async history(relPath: string): Promise<CommitInfo[]> {
    assertInside(this.root, relPath);

    return history(this.git, relPath);
  }

  async atCommit(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);

    return atCommit(this.git, relPath, assertSha(sha));
  }

  async diff(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);

    return diff(this.git, relPath, assertSha(sha));
  }

  /**
   * Bring an old version's text back as a new commit; the history is never rewritten.
   * The details — title, project, tags, the star — stay as they are today. Each of those
   * is a commit too, so restoring "the version before my edit" also unstarred the doc, or
   * renamed and moved it back to where it lived months ago.
   */
  async restore(relPath: string, sha: string): Promise<SaveResult> {
    return this.git.exclusive(async () => {
      const { frontmatter, body } = parseDoc(await this.atCommit(relPath, sha));
      const fm = this.index.get(relPath) ?? frontmatter;
      if (!fm) throw new Error("Nothing to restore");

      return this.saveNow({
        body,
        frontmatter: pickFrontmatter(fm),
        existingPath: relPath,
        commit: true,
      });
    });
  }

  // ---- projects -----------------------------------------------------------------

  projects(): string[] {
    return projects(this);
  }

  async renameProject(from: string, to: string): Promise<{ moved: number }> {
    return this.git.exclusive(() => renameProject(this, from, to));
  }

  // ---- README index -----------------------------------------------------------------

  async writeReadme(): Promise<boolean> {
    return writeReadme(this.root, this.index.snapshot());
  }

  // ---- views & templates --------------------------------------------------------

  async listViews(): Promise<SavedView[]> {
    return this.views.list();
  }

  async saveView(view: SavedView): Promise<SavedView[]> {
    return this.git.exclusive(() => this.views.save(view));
  }

  async deleteView(name: string): Promise<SavedView[]> {
    return this.git.exclusive(() => this.views.remove(name));
  }

  async listTemplates(): Promise<Template[]> {
    return this.views.templates();
  }

  // ---- search ---------------------------------------------------------------------

  search(text: string, filters?: string): SearchHit[] {
    return this.index.query(text, undefined, filters);
  }

  // ---- sync ------------------------------------------------------------------------
  // All of it — timers, the queue, the retry schedule and the rebase settlement — lives
  // in SyncEngine. These are the surface the rest of the app already calls.

  status(): SyncStatus {
    return this.syncEngine.status();
  }

  schedulePush(): void {
    this.syncEngine.schedulePush();
  }

  async refreshSyncStatus(): Promise<SyncStatus> {
    return this.syncEngine.refreshSyncStatus();
  }

  async pushNow(): Promise<SyncStatus> {
    return this.syncEngine.pushNow();
  }

  async pull(): Promise<PullResult> {
    return this.syncEngine.pull();
  }

  // ---- conflicts --------------------------------------------------------------------

  async conflicts(): Promise<ConflictPair[]> {
    return conflicts(this);
  }

  /**
   * One pair at a time, and never beside a save or a pull. Two answers in flight at once
   * — both cards clicked — could send both versions to the trash.
   */
  async resolveConflict(copyPath: string, choice: ConflictChoice): Promise<void> {
    await this.git.exclusive(() =>
      resolveConflict(
        {
          index: this.index,
          read: (p) => this.read(p),
          save: (r) => this.saveNow(r),
          trash: (p) => this.trashNow(p),
          restoreFromTrash: (p) => restoreFromTrash(this, p),
          refreshSyncStatus: () => this.refreshSyncStatus(),
        },
        copyPath,
        choice,
        pickFrontmatter,
      ),
    );
  }
}

/** The metadata a save writes: the request's, with what the file itself decides kept. */
function frontmatterFor(req: SaveRequest, title: string, existing: ExistingDoc): Frontmatter {
  const fm: Frontmatter = {
    title,
    project: (req.frontmatter.project ?? "").trim(),
    tags: [...new Set(req.frontmatter.tags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean))],
    created: existing.created || new Date().toISOString(),
    source: req.frontmatter.source,
  };
  if (existing.starred ?? req.frontmatter.starred) fm.starred = true;

  return fm;
}

function folderOf(relPath: string): string {
  return relPath.includes("/") ? dirname(relPath) : "";
}

/** How long a closing vault waits for work already under way before letting go. */
const CLOSE_WAIT_MS = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms).unref?.());
}

/** A short, stable fingerprint of a document's text. */
function fingerprint(raw: string): string {
  return createHash("sha1").update(raw).digest("hex");
}

/**
 * A commit id from the renderer, before it reaches a git command line: anything else —
 * `--output=…` above all — would be read by git as an option.
 */
function assertSha(sha: string): string {
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) throw new Error(`Not a commit: ${sha}`);

  return sha;
}

function pickFrontmatter(m: Frontmatter): Frontmatter {
  return {
    title: m.title,
    project: m.project,
    tags: m.tags,
    source: m.source,
    created: m.created,
    starred: m.starred,
  };
}

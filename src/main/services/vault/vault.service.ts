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
import { writeReadme } from "./readme";
import { SyncEngine } from "./sync.service";
import { listTrash, purgeTrash, readTrashed, restoreFromTrash } from "./trash";
import type { TokenProvider } from "./vault.types";
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
    await this.index.close();
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
    const meta = this.index.get(relPath) ?? (await this.index.refreshFile(relPath));
    if (!meta) throw new Error(`Not in index: ${relPath}`);

    return { meta, body, raw };
  }

  pathFor(project: string, title: string): string {
    return `${projectSlug(project)}/${slugify(title)}.md`;
  }

  /** Path preview for the editor footer. */
  previewPath(project: string, title: string): string {
    return this.pathFor(project, title || "untitled");
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
    if (req.existingPath) assertInside(this.root, req.existingPath);
    const title = (req.frontmatter.title || inferTitle(req.body) || "Untitled").trim();
    let created = req.frontmatter.created;
    let extra: Record<string, unknown> = {};
    if (req.existingPath && existsSync(join(this.root, req.existingPath))) {
      const prev = parseDoc(await fs.readFile(join(this.root, req.existingPath), "utf8"));
      created = created ?? prev.frontmatter?.created;
      extra = prev.extra;
    }
    const fm: Frontmatter = {
      title,
      project: (req.frontmatter.project ?? "").trim(),
      tags: [
        ...new Set(req.frontmatter.tags.map((t) => t.replace(/^#/, "").trim()).filter(Boolean)),
      ],
      created: created ?? new Date().toISOString(),
      source: req.frontmatter.source,
    };
    if (req.frontmatter.starred) fm.starred = true;

    const target = this.uniquePath(this.pathFor(fm.project, fm.title), req.existingPath);
    const abs = join(this.root, target);
    await fs.mkdir(dirname(abs), { recursive: true });

    // Something else wrote this file while it was open here — another editor, a pull, a
    // second Vault window. Its version is committed before ours lands on top, so it is
    // one entry back in the history drawer rather than gone. We do not refuse the save:
    // the user is mid-thought, and their text is the one thing that must not be lost.
    const preservedExternalEdit = await this.preserveExternalEdit(req, title);

    const isNew = !req.existingPath;
    const moved = !!req.existingPath && req.existingPath !== target;
    if (moved) await this.git.mv(req.existingPath!, target);

    let body = req.body;
    let assets: string[] = [];
    if (req.assets?.refs.length) {
      const imported = await importAssets(this.root, dirname(target), req.assets);
      body = rewriteAssetRefs(body, imported.map);
      assets = imported.paths;
    }
    await fs.writeFile(abs, composeDoc(fm, body, extra));

    const meta = (await this.index.refreshFile(target))!;
    if (moved) this.index.remove(req.existingPath!);

    let committed = false;
    if (req.commit) {
      const message = isNew
        ? `add: ${fm.title}`
        : moved
          ? `move: ${fm.title}`
          : `update: ${fm.title}`;
      await this.git.commitPaths([target, ...assets], message);
      await this.writeReadme();
      await this.git.commitPaths([README_FILE], message, { amend: true });
      committed = true;
      this.schedulePush();
    }
    this.emit("index", this.index.snapshot());

    return { path: target, meta, committed, assets, preservedExternalEdit };
  }

  /**
   * Commit whatever is on disk before overwriting it, when the file has changed since the
   * editor loaded it. Returns true only when there was a real change to keep — a touched
   * file with identical contents stages nothing, and an empty commit is not worth making.
   */
  private async preserveExternalEdit(req: SaveRequest, title: string): Promise<boolean> {
    if (!req.existingPath || !req.baseMtime) return false;
    const abs = join(this.root, req.existingPath);
    if (!existsSync(abs)) return false;
    const { mtimeMs } = await fs.stat(abs);
    // Filesystems round mtimes differently; only a clearly later write counts.
    if (mtimeMs <= req.baseMtime + MTIME_SLACK_MS) return false;
    const changed = (await this.git.git.status()).files.some((f) => f.path === req.existingPath);
    if (!changed) return false;
    await this.git.commitPaths([req.existingPath], `external: ${title}`);

    return true;
  }

  async setStarred(relPath: string, starred: boolean): Promise<DocMeta> {
    const { body, meta } = await this.read(relPath);
    const res = await this.save({
      body,
      frontmatter: { ...pickFrontmatter(meta), starred },
      existingPath: relPath,
      commit: true,
    });

    return res.meta;
  }

  /** PRD Q5: move to `.trash/` (scanner skips it) rather than `git rm`. */
  async trash(relPath: string): Promise<TrashedDoc> {
    assertInside(this.root, relPath);
    const dest = this.uniquePath(`${TRASH_DIR}/${relPath}`);
    await fs.mkdir(dirname(join(this.root, dest)), { recursive: true });
    const meta = this.index.get(relPath) ?? (await this.index.readMeta(relPath));
    if (!meta) throw new Error(`Not a document: ${relPath}`);
    await this.git.mv(relPath, dest);
    this.index.remove(relPath);
    await this.git.commitPaths([dest], `trash: ${meta.title}`);
    await this.writeReadme();
    await this.git.commitPaths([README_FILE], "", { amend: true });
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
    return restoreFromTrash(this, path);
  }

  async purgeTrash(path?: string): Promise<{ removed: number; assets: string[] }> {
    return purgeTrash(this, path);
  }

  // ---- history ------------------------------------------------------------------

  async history(relPath: string): Promise<CommitInfo[]> {
    assertInside(this.root, relPath);

    return history(this.git, relPath);
  }

  async atCommit(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);

    return atCommit(this.git, relPath, sha);
  }

  async diff(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);

    return diff(this.git, relPath, sha);
  }

  /** Bring an old version back as a new commit; the history is never rewritten. */
  async restore(relPath: string, sha: string): Promise<SaveResult> {
    const { frontmatter, body } = parseDoc(await this.atCommit(relPath, sha));
    const fm = frontmatter ?? this.index.get(relPath);
    if (!fm) throw new Error("Nothing to restore");

    return this.save({
      body,
      frontmatter: pickFrontmatter(fm),
      existingPath: relPath,
      commit: true,
    });
  }

  // ---- projects -----------------------------------------------------------------

  projects(): string[] {
    return projects(this);
  }

  async renameProject(from: string, to: string): Promise<{ moved: number }> {
    return renameProject(this, from, to);
  }

  // ---- README index -----------------------------------------------------------------

  async writeReadme(): Promise<void> {
    await writeReadme(this.root, this.index.snapshot());
  }

  // ---- views & templates --------------------------------------------------------

  async listViews(): Promise<SavedView[]> {
    return this.views.list();
  }

  async saveView(view: SavedView): Promise<SavedView[]> {
    return this.views.save(view);
  }

  async deleteView(name: string): Promise<SavedView[]> {
    return this.views.remove(name);
  }

  async listTemplates(): Promise<Template[]> {
    return this.views.templates();
  }

  // ---- search ---------------------------------------------------------------------

  search(text: string): SearchHit[] {
    return this.index.query(text);
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

  async pull(): Promise<{ conflicts: ConflictPair[] }> {
    return this.syncEngine.pull();
  }

  // ---- conflicts --------------------------------------------------------------------

  async conflicts(): Promise<ConflictPair[]> {
    return conflicts(this);
  }

  async resolveConflict(copyPath: string, choice: ConflictChoice): Promise<void> {
    await resolveConflict(this, copyPath, choice, pickFrontmatter);
  }
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

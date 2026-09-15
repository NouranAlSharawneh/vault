import { promises as fs, existsSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { EventEmitter } from "node:events";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  ASSETS_DIR,
  DEFAULT_BRANCH,
  FROM_REMOTE_SUFFIX,
  GIT_IDENTITY,
  INBOX_SLUG,
  MTIME_SLACK_MS,
  PULL_INTERVAL_MS,
  PUSH_RETRY_MAX_MS,
  PUSH_RETRY_MIN_MS,
  README_FILE,
  REBASE_MAX_STOPS,
  TRASH_DIR,
  VAULT_DIR,
} from "@shared/constants";
import { composeDoc, parseDoc, splitFrontmatter } from "@shared/frontmatter";
import { inferTitle, projectSlug, rewriteAssetRefs, slugify, unslug } from "@shared/helpers";
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
import { importAssets, orphanedAssets } from "../assets";
import { classifyPushError } from "./classify-push-error";
import { GitService } from "../git/git.service";
import { IndexerService } from "../indexer/indexer.service";
import type { TokenProvider } from "./vault.types";

const ADR_TEMPLATE =
  "---\ntitle: ADR\ntags: [adr]\nsource: manual\n---\n# ADR NNN — Title\n\n## Context\n\n## Decision\n\n## Consequences\n";

/**
 * Everything that touches the vault folder: save, trash, rename, history,
 * views, templates, and the commit → debounced push pipeline.
 * Emits `index`, `progress`, `sync`, `auth-ok`, `auth-suspect`.
 */
export class VaultService extends EventEmitter {
  readonly git: GitService;
  readonly index: IndexerService;
  private sync: SyncStatus = {
    state: "synced",
    ahead: 0,
    behind: 0,
    branch: DEFAULT_BRANCH,
    lastPushAt: null,
    lastError: null,
    remote: null,
    conflicts: 0,
  };
  private pushTimer: NodeJS.Timeout | null = null;
  private pullTimer: NodeJS.Timeout | null = null;
  private pushing = false;
  private pullInFlight: Promise<{ conflicts: ConflictPair[] }> | null = null;
  /** The tail of the queue every remote operation waits behind. See `queue()`. */
  private remoteWork: Promise<unknown> = Promise.resolve();
  private retryDelay = PUSH_RETRY_MIN_MS;

  constructor(
    readonly config: VaultConfig,
    cacheDir: string,
    private readonly tokenProvider: TokenProvider,
    /**
     * Renew an expiring token before we use it. Without this the first push after the
     * token's deadline always fails in the user's face before recovery kicks in, because
     * the only other refresh happens at startup.
     */
    private readonly freshenToken: () => Promise<void> = async () => undefined,
  ) {
    super();
    this.git = new GitService(config.root, tokenProvider);
    this.index = new IndexerService(config.root, cacheDir, this.git);
    this.index.on("changed", (s: IndexSnapshot) => this.emit("index", s));
    this.index.on("progress", (p) => this.emit("progress", p));
  }

  get root(): string {
    return this.config.root;
  }

  async open(): Promise<IndexSnapshot> {
    await fs.mkdir(this.root, { recursive: true });
    if (!(await this.git.isRepo())) await GitService.init(this.root, this.config.branch);
    await this.git.ensureIdentity(GIT_IDENTITY.name, GIT_IDENTITY.email);
    await this.ensureScaffold();
    this.sync.branch = await this.git.currentBranch();
    this.sync.remote = this.config.remote;
    const snap = await this.index.load();
    if (!existsSync(join(this.root, README_FILE))) await this.writeReadme();
    this.index.watch();
    // Anything committed but never pushed — quit inside the debounce, or written while
    // offline — would otherwise sit here forever, because the only thing that ever pushes
    // is another save. The badge said "not pushed" and nothing was ever going to act on it.
    void this.refreshSyncStatus().then((s) => {
      if (s.ahead > 0) this.schedulePush();
    });
    this.startPulling();
    return snap;
  }

  async close(): Promise<void> {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pullTimer) clearInterval(this.pullTimer);
    await this.index.close();
  }

  /**
   * A quiet fetch on a long interval. Without it a document written on another machine —
   * or on github.com — never reaches this one until you happen to save something here,
   * because only a push ever goes to the network. An interrupted rebase from a previous
   * run is also cleaned up by the first tick.
   */
  private startPulling(): void {
    if (!this.config.remote || this.pullTimer) return;
    this.pullTimer = setInterval(() => void this.pull(), PULL_INTERVAL_MS);
    // Node keeps the process alive for a pending timer; a background fetch should not.
    this.pullTimer.unref?.();
    void this.pull();
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

  private async uniquePath(wanted: string, keep?: string): Promise<string> {
    if (wanted === keep || !existsSync(join(this.root, wanted))) return wanted;
    const base = wanted.replace(/\.md$/, "");
    for (let i = 2; i < 1000; i++) {
      const p = `${base}-${i}.md`;
      if (p === keep || !existsSync(join(this.root, p))) return p;
    }
    throw new Error("Could not find a unique filename");
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

    const target = await this.uniquePath(this.pathFor(fm.project, fm.title), req.existingPath);
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
    const dest = await this.uniquePath(`${TRASH_DIR}/${relPath}`);
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

  /** Everything under `.trash/`, newest first. Read from disk — the index skips it. */
  async listTrash(): Promise<TrashedDoc[]> {
    const dir = join(this.root, TRASH_DIR);
    if (!existsSync(dir)) return [];
    const files = await walkMarkdown(dir);
    const out: TrashedDoc[] = [];
    for (const abs of files) {
      const path = abs
        .slice(this.root.length + 1)
        .split(sep)
        .join("/");
      const meta = await this.index.readMeta(path);
      if (!meta) continue;
      const originalPath = path.slice(TRASH_DIR.length + 1);
      const [last] = await this.git.log(path, 1);
      // readMeta saw the `.trash/…` path, so it read the project off that folder.
      // Recover it from where the document used to live.
      const folder = originalPath.includes("/") ? originalPath.split("/")[0] : INBOX_SLUG;
      const project = meta.project === unslug(TRASH_DIR) ? "" : meta.project;
      out.push({
        meta: { ...meta, project, projectSlug: project ? projectSlug(project) : folder },
        path,
        originalPath,
        trashedAt: last?.date ?? new Date(meta.mtime).toISOString(),
      });
    }
    return out.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
  }

  async readTrashed(path: string): Promise<DocContent> {
    assertInTrash(path);
    const raw = await fs.readFile(join(this.root, path), "utf8");
    const meta = await this.index.readMeta(path);
    if (!meta) throw new Error(`Not a document: ${path}`);
    return { meta, body: parseDoc(raw).body, raw };
  }

  /** Move a trashed doc back where it came from (a new `-2` name if that path is taken). */
  async restoreFromTrash(path: string): Promise<SaveResult> {
    assertInTrash(path);
    const target = await this.uniquePath(path.slice(TRASH_DIR.length + 1));
    await fs.mkdir(dirname(join(this.root, target)), { recursive: true });
    await this.git.mv(path, target);
    const meta = await this.index.refreshFile(target);
    if (!meta) throw new Error(`Could not index ${target}`);
    await this.git.commitPaths([target], `restore: ${meta.title}`);
    await this.writeReadme();
    await this.git.commitPaths([README_FILE], "", { amend: true });
    this.schedulePush();
    this.emit("index", this.index.snapshot());
    return { path: target, meta, committed: true };
  }

  /**
   * Delete one trashed doc — or the whole `.trash/` folder — for good, in one commit,
   * taking the images that only it was using with it. Trashing deliberately leaves those
   * behind so a restore can find them; this is the last moment anything can.
   */
  async purgeTrash(path?: string): Promise<{ removed: number; assets: string[] }> {
    if (path) {
      assertInTrash(path);
      const meta = await this.index.readMeta(path);
      if (!meta) return { removed: 0, assets: [] };
      const assets = await orphanedAssets(this.root, [path]);
      await this.removeAll([path, ...assets]);
      await this.git.commitPaths([], `purge: ${meta.title}`);
      this.schedulePush();
      return { removed: 1, assets };
    }
    const trashed = await this.listTrash();
    const removed = trashed.length;
    if (!existsSync(join(this.root, TRASH_DIR))) return { removed: 0, assets: [] };
    const assets = await orphanedAssets(
      this.root,
      trashed.map((t) => t.path),
    );
    await this.removeAll([TRASH_DIR, ...assets]);
    await this.git.commitPaths([], `purge: trash (${removed} ${removed === 1 ? "doc" : "docs"})`);
    this.schedulePush();
    return { removed, assets };
  }

  /** Drop paths from git and from disk, then any `assets/` folder left with nothing in it. */
  private async removeAll(paths: string[]): Promise<void> {
    for (const p of paths) {
      await this.git.removeTree(p);
      await fs.rm(join(this.root, p), { recursive: true, force: true });
    }
    for (const dir of new Set(paths.map(dirname).filter((d) => basename(d) === ASSETS_DIR))) {
      await fs.rmdir(join(this.root, dir)).catch(() => undefined);
    }
  }

  async history(relPath: string): Promise<CommitInfo[]> {
    assertInside(this.root, relPath);
    return this.git.log(relPath);
  }

  async atCommit(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);
    return this.git.show(await this.pathAt(relPath, sha), sha);
  }

  /** What this commit changed, as a unified diff. */
  async diff(relPath: string, sha: string): Promise<string> {
    assertInside(this.root, relPath);
    return this.git.diff(await this.pathAt(relPath, sha), sha);
  }

  /**
   * Where this document lived at that commit. Moving a doc between projects is a
   * `git mv`, so asking for today's path at an older commit finds nothing.
   */
  private async pathAt(relPath: string, sha: string): Promise<string> {
    const found = (await this.git.log(relPath)).find((c) => c.sha === sha);
    return found?.path ?? relPath;
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
    return [
      ...new Set(
        this.index
          .all()
          .map((d) => d.project)
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }

  /** PRD D2: one atomic commit that moves the folder and rewrites `project:`. */
  async renameProject(from: string, to: string): Promise<{ moved: number }> {
    const fromSlug = projectSlug(from);
    const toSlug = projectSlug(to);
    if (fromSlug === INBOX_SLUG) throw new Error("Inbox cannot be renamed");
    const docs = this.index.all().filter((d) => d.projectSlug === fromSlug);
    if (!docs.length) return { moved: 0 };
    await fs.mkdir(join(this.root, toSlug), { recursive: true });
    const touched: string[] = [];
    for (const d of docs) {
      const dest =
        fromSlug === toSlug
          ? d.path
          : await this.uniquePath(`${toSlug}/${d.path.split("/").pop()}`);
      const raw = await fs.readFile(join(this.root, d.path), "utf8");
      const { frontmatter, body, extra } = parseDoc(raw);
      const next = frontmatter ? composeDoc({ ...frontmatter, project: to }, body, extra) : raw;
      if (dest !== d.path) {
        await fs.rename(join(this.root, d.path), join(this.root, dest));
        this.index.remove(d.path);
      }
      await fs.writeFile(join(this.root, dest), next);
      touched.push(dest);
    }
    if (fromSlug !== toSlug) {
      // The documents have moved; everything else in the folder has not. `assets/` above
      // all — leaving it behind broke every relative image in the project and left the
      // old folder sitting on disk, because the rmdir here could never succeed.
      await this.moveRemaining(join(this.root, fromSlug), join(this.root, toSlug));
      await fs.rmdir(join(this.root, fromSlug)).catch(() => undefined);
    }
    for (const p of touched) await this.index.refreshFile(p);
    await this.writeReadme();
    // git detects the moves as renames on its own; one commit covers both folders.
    await this.git.git.add(["-A", "--", fromSlug, toSlug, README_FILE]);
    await this.git.git.commit(`rename project: ${from} → ${to}`);
    this.schedulePush();
    this.emit("index", this.index.snapshot());
    return { moved: docs.length };
  }

  /**
   * Move whatever a project folder still holds into its new home, merging directories
   * rather than replacing them. A name already taken on the other side keeps both files:
   * one of the two references will be wrong, but no bytes are thrown away.
   */
  private async moveRemaining(fromDir: string, toDir: string): Promise<void> {
    const entries = await fs.readdir(fromDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const src = join(fromDir, entry.name);
      if (entry.isDirectory()) {
        await fs.mkdir(join(toDir, entry.name), { recursive: true });
        await this.moveRemaining(src, join(toDir, entry.name));
        await fs.rmdir(src).catch(() => undefined);
        continue;
      }
      let dest = join(toDir, entry.name);
      for (let i = 2; existsSync(dest) && i < 1000; i++) {
        const dot = entry.name.lastIndexOf(".");
        const [stem, ext] = dot > 0 ? [entry.name.slice(0, dot), entry.name.slice(dot)] : [entry.name, ""];
        dest = join(toDir, `${stem}-${i}${ext}`);
      }
      await fs.rename(src, dest);
    }
  }

  // ---- README index ---------------------------------------------------------------

  async writeReadme(): Promise<void> {
    const snap = this.index.snapshot();
    const lines = [
      "# Vault",
      "",
      `${snap.docs.length} documents · generated by Vault, do not edit by hand.`,
      "",
    ];
    for (const p of snap.projects) {
      lines.push(`## ${p.name} (${p.count})`, "");
      for (const d of snap.docs.filter((x) => x.projectSlug === p.slug)) {
        const tags = d.tags.length ? " · " + d.tags.map((t) => "#" + t).join(" ") : "";
        lines.push(`- [${d.title}](${encodeURI(d.path)}) — ${d.created.slice(0, 10)}${tags}`);
      }
      lines.push("");
    }
    await fs.writeFile(join(this.root, README_FILE), lines.join("\n"));
  }

  // ---- views & templates --------------------------------------------------------

  private viewsPath(): string {
    return join(this.root, VAULT_DIR, "views.yml");
  }

  async listViews(): Promise<SavedView[]> {
    try {
      const data = parseYaml(await fs.readFile(this.viewsPath(), "utf8")) as
        { views?: SavedView[] } | SavedView[] | null;
      const arr = Array.isArray(data) ? data : (data?.views ?? []);
      return arr.filter((v) => v && typeof v.name === "string" && typeof v.query === "string");
    } catch {
      return [];
    }
  }

  async saveView(view: SavedView): Promise<SavedView[]> {
    const views = (await this.listViews()).filter((v) => v.name !== view.name);
    views.push(view);
    await this.writeViews(views, `view: ${view.name}`);
    return views;
  }

  async deleteView(name: string): Promise<SavedView[]> {
    const views = (await this.listViews()).filter((v) => v.name !== name);
    await this.writeViews(views, `remove view: ${name}`);
    return views;
  }

  private async writeViews(views: SavedView[], message: string): Promise<void> {
    await fs.mkdir(dirname(this.viewsPath()), { recursive: true });
    await fs.writeFile(this.viewsPath(), stringifyYaml({ views }));
    await this.git.commitPaths([".vault/views.yml"], message);
    this.schedulePush();
  }

  async listTemplates(): Promise<Template[]> {
    const dir = join(this.root, VAULT_DIR, "templates");
    try {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
      const out: Template[] = [];
      for (const f of files) {
        const { yaml, body } = splitFrontmatter(await fs.readFile(join(dir, f), "utf8"));
        let frontmatter: Partial<Frontmatter> = {};
        try {
          const parsed = yaml ? (parseYaml(yaml) as Record<string, unknown>) : {};
          if (parsed && typeof parsed === "object") frontmatter = parsed as Partial<Frontmatter>;
        } catch {
          /* template with broken yaml still usable as body */
        }
        out.push({ name: unslug(f.replace(/\.md$/, "")), frontmatter, body });
      }
      return out;
    } catch {
      return [];
    }
  }

  // ---- search ---------------------------------------------------------------------

  search(text: string): SearchHit[] {
    return this.index.query(text);
  }

  // ---- sync -----------------------------------------------------------------------

  status(): SyncStatus {
    return this.sync;
  }

  private setSync(patch: Partial<SyncStatus>): void {
    this.sync = { ...this.sync, ...patch };
    this.emit("sync", this.sync);
  }

  /** PRD Q6: commit immediately, push on a short debounce. */
  schedulePush(): void {
    if (!this.config.remote) return;
    this.setSync({ state: "pending" });
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.pushNow(), this.config.pushDebounceMs);
  }

  async refreshSyncStatus(): Promise<SyncStatus> {
    const ab = await this.git.aheadBehind();
    await this.index.markUnpushed(await this.git.unpushedPaths());
    // Counted off the documents themselves rather than remembered, so it survives a
    // restart with a pair still unanswered and clears itself the moment the last one is
    // settled. Error and offline stay sticky until something changes them.
    const conflicts = (await this.conflicts()).length;
    const sticky = this.sync.state === "error" || this.sync.state === "offline";
    const state: SyncStatus["state"] = sticky
      ? this.sync.state
      : ab.ahead > 0
        ? "pending"
        : "synced";
    this.setSync({ ...ab, state, conflicts });
    return this.sync;
  }

  private async ensureRemote(): Promise<void> {
    if (!(await this.git.hasRemote()))
      await this.git.setRemote(`https://github.com/${this.config.remote}.git`);
  }

  /**
   * One queue for everything that touches the remote.
   *
   * A push and a pull both drive a rebase, and each was guarded only against a second of
   * its own kind. Run together — which the interval timer and a save do without trying —
   * one of them finished the other's rebase and the loser reported `fatal: No rebase in
   * progress?`, leaving a red badge until the retry backoff quietly fixed it five seconds
   * later. They cannot overlap now.
   */
  private queue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.remoteWork.then(work, work);
    // The caller owns this rejection; the queue itself must stay resolvable.
    this.remoteWork = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async pushNow(): Promise<SyncStatus> {
    if (!this.config.remote) return this.sync;
    return this.queue(() => this.runPush());
  }

  private async runPush(): Promise<SyncStatus> {
    if (this.pushing) return this.sync;
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.pushing = true;
    this.setSync({ state: "pushing", lastError: null });
    try {
      await this.freshenToken();
      await this.ensureRemote();
      try {
        await this.git.push();
      } catch (e) {
        // non fast-forward → rebase on top of the remote first
        if (!/rejected|non-fast-forward|fetch first/i.test(String((e as Error).message ?? e)))
          throw e;
        // Both versions are kept and committed, so the push that follows carries them
        // both up. It never stops here waiting for an answer.
        const conflicted = await this.git.pullRebase();
        if (conflicted.length) {
          await this.settleRebase(conflicted);
          await this.index.rescan();
          this.emit("index", this.index.snapshot());
        }
        await this.git.push();
      }
      this.retryDelay = PUSH_RETRY_MIN_MS;
      this.emit("auth-ok");
      this.setSync({ state: "synced", lastPushAt: Date.now(), ahead: 0 });
      await this.index.markUnpushed(new Set());
      await this.refreshSyncStatus();
    } catch (e) {
      const msg = redact(String((e as Error).message ?? e), this.tokenProvider());
      const failure = classifyPushError(msg);
      this.setSync({ state: failure === "offline" ? "offline" : "error", lastError: msg });
      if (failure === "bad-credentials" || failure === "no-permission") {
        this.emit("auth-suspect");
      } else {
        // back off and retry; the commit is safe on disk
        this.pushTimer = setTimeout(() => void this.pushNow(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, PUSH_RETRY_MAX_MS);
      }
    } finally {
      this.pushing = false;
    }
    return this.sync;
  }

  /**
   * Fetch and rebase. A conflict is never left sitting in the working tree: both versions
   * are kept, committed, and the copy is stamped so it can be found again — so the repo
   * is clean by the time this returns and nothing downstream has to know what a rebase is.
   */
  async pull(): Promise<{ conflicts: ConflictPair[] }> {
    if (!this.config.remote) return { conflicts: [] };
    // Asking for a pull while one is already running joins it rather than being told
    // "nothing happened" — the timer and a button press land on the same answer.
    if (!this.pullInFlight) {
      this.pullInFlight = this.queue(() => this.runPull());
      void this.pullInFlight.finally(() => {
        this.pullInFlight = null;
      });
    }
    return this.pullInFlight;
  }

  private async runPull(): Promise<{ conflicts: ConflictPair[] }> {
    try {
      await this.freshenToken();
      await this.ensureRemote();
      // A rebase left over from a crash has to finish before a new one can start.
      if (this.git.rebaseInProgress()) await this.settleRebase();
      else {
        const conflicted = await this.git.pullRebase();
        if (conflicted.length) await this.settleRebase(conflicted);
      }
      await this.index.rescan();
      this.emit("index", this.index.snapshot());
      await this.refreshSyncStatus();
      return { conflicts: await this.conflicts() };
    } catch (e) {
      // Whatever went wrong, do not leave the vault half-rebased: the next save would
      // commit onto a detached HEAD and the user would have no way to see why.
      await this.git.abortRebase();
      const msg = redact(String((e as Error).message ?? e), this.tokenProvider());
      const failure = classifyPushError(msg);
      if (failure === "bad-credentials" || failure === "no-permission") this.emit("auth-suspect");
      this.setSync({ state: failure === "offline" ? "offline" : "error", lastError: msg });
      return { conflicts: [] };
    }
  }

  /**
   * Carry a rebase to the end, keeping both sides of every conflict it stops on. A rebase
   * replays each local commit in turn, so it can stop more than once — hence the loop.
   */
  private async settleRebase(first?: string[]): Promise<void> {
    let conflicted = first ?? (await this.git.conflictedPaths());
    for (let i = 0; this.git.rebaseInProgress() && i < REBASE_MAX_STOPS; i++) {
      if (conflicted.length) await this.keepBothSides(conflicted);
      await this.git.continueRebase();
      conflicted = await this.git.conflictedPaths();
    }
    if (this.git.rebaseInProgress()) throw new Error("Rebase did not finish");
  }

  /**
   * Resolve every conflicted path without asking and without losing anything: this
   * machine's version stays where it is, and the version from GitHub is written beside it
   * as its own document, stamped so the pair can be found again.
   */
  private async keepBothSides(paths: string[]): Promise<void> {
    for (const path of paths) {
      const mine = await this.git.conflictSide(path, "mine");
      const remote = await this.git.conflictSide(path, "remote");
      // The README is generated from the index, so there is nothing to choose between.
      if (path === README_FILE) {
        await this.git.takeSide(path, mine === null ? "remote" : "mine");
        continue;
      }
      // One side deleted it. Keeping the surviving text is the only non-destructive move.
      if (mine === null || remote === null) {
        await this.git.takeSide(path, mine === null ? "remote" : "mine");
        continue;
      }
      // Assets and anything else that isn't a document get the same treatment by bytes:
      // mine stays, theirs lands beside it under a name that says where it came from.
      if (!path.endsWith(".md")) {
        await this.git.takeSide(path, "mine");
        const copy = await this.uniqueSibling(path, FROM_REMOTE_SUFFIX);
        await fs.writeFile(join(this.root, copy), remote);
        await this.git.git.add([copy]);
        continue;
      }
      await this.git.takeSide(path, "mine");
      const copy = await this.uniqueSibling(path, FROM_REMOTE_SUFFIX);
      const parsed = parseDoc(remote);
      const fm: Frontmatter = {
        ...(parsed.frontmatter ?? {
          title: inferTitle(parsed.body) ?? "Untitled",
          project: "",
          tags: [],
          created: new Date().toISOString(),
          source: "other",
        }),
        conflict: { of: path, from: "github", at: await this.remoteDateFor(path) },
      };
      await fs.writeFile(join(this.root, copy), composeDoc(fm, parsed.body, parsed.extra));
      await this.git.git.add([copy]);
    }
  }

  /** When the version on GitHub was written, for "GitHub · today 14:29". */
  private async remoteDateFor(path: string): Promise<string> {
    try {
      const out = await this.git.git.raw([
        "log",
        "-1",
        "--format=%aI",
        `origin/${this.sync.branch}`,
        "--",
        path,
      ]);
      return out.trim() || new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private async uniqueSibling(path: string, suffix: string): Promise<string> {
    const dot = path.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [path.slice(0, dot), path.slice(dot)] : [path, ""];
    if (ext === ".md") return this.uniquePath(`${stem}${suffix}.md`);
    for (let i = 1; i < 1000; i++) {
      const p = i === 1 ? `${stem}${suffix}${ext}` : `${stem}${suffix}-${i}${ext}`;
      if (!existsSync(join(this.root, p))) return p;
    }
    throw new Error("Could not find a unique filename");
  }

  /** Every pair of versions still waiting on a decision, newest arrival first. */
  async conflicts(): Promise<ConflictPair[]> {
    const docs = this.index.snapshot().docs;
    const byPath = new Map(docs.map((d) => [d.path, d]));
    const pairs: ConflictPair[] = [];
    for (const theirs of docs) {
      const mark = theirs.conflict;
      const mine = mark && byPath.get(mark.of);
      if (mark && mine) pairs.push({ mine, theirs, mark });
    }
    return pairs.sort((a, b) => b.mark.at.localeCompare(a.mark.at));
  }

  /**
   * Settle one pair. `copyPath` is the stamped copy; the choice is about which text ends
   * up at the original path. Nothing is deleted — the loser goes to the trash, and both
   * versions stay in history either way.
   */
  async resolveConflict(copyPath: string, choice: ConflictChoice): Promise<void> {
    const copy = await this.read(copyPath);
    const mark = copy.meta.conflict;
    if (!mark) throw new Error(`Not a conflict copy: ${copyPath}`);
    if (choice === "theirs") {
      // The version from GitHub wins: it takes the original's path, and the original
      // goes to the trash where it can still be brought back.
      const original = await this.read(mark.of).catch(() => null);
      if (original) await this.trash(mark.of);
      await this.save({
        body: copy.body,
        frontmatter: pickFrontmatter(original?.meta ?? copy.meta),
        existingPath: copyPath,
        commit: true,
      });
    } else if (choice === "mine") {
      await this.trash(copyPath);
    } else {
      // Keep both as separate documents. The stamp goes, and with it the only thing
      // telling the two apart — they share a title — so the title says it instead.
      await this.save({
        body: copy.body,
        frontmatter: { ...pickFrontmatter(copy.meta), title: `${copy.meta.title} (from GitHub)` },
        existingPath: copyPath,
        commit: true,
      });
    }
    await this.refreshSyncStatus();
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

function redact(msg: string, token: string | null): string {
  return token ? msg.split(token).join("•••") : msg;
}

/**
 * Every path the renderer hands us is joined onto the vault root, so every one of them
 * has to be proved to land inside it. `../x.md` was caught by accident — the indexer
 * refuses a path starting with a dot — but `sub/../../../x.md` passed, and `read` would
 * return the file, index it, and write its path into the README that gets pushed.
 *
 * The asset protocol has always done this. The document paths had not.
 */
function assertInside(root: string, relPath: string): string {
  const abs = resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`Outside the vault: ${relPath}`);
  }
  return abs;
}

function assertInTrash(path: string): void {
  if (!path.startsWith(`${TRASH_DIR}/`) || path.includes("..")) {
    throw new Error(`Not a trashed document: ${path}`);
  }
}

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkMarkdown(abs)));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(abs);
  }
  return out;
}

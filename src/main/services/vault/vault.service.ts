import { promises as fs, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { EventEmitter } from "node:events";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  DEFAULT_BRANCH,
  GIT_IDENTITY,
  INBOX_SLUG,
  PUSH_RETRY_MAX_MS,
  PUSH_RETRY_MIN_MS,
  README_FILE,
  TRASH_DIR,
  VAULT_DIR,
} from "@shared/constants";
import { composeDoc, parseDoc, splitFrontmatter } from "@shared/frontmatter";
import { countWords, inferTitle, projectSlug, slugify, unslug } from "@shared/helpers";
import type {
  CommitInfo,
  ConflictChoice,
  ConflictFile,
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
  VaultConfig,
} from "@shared/types";
import { GitService } from "../git/git.service";
import { IndexerService } from "../indexer/indexer.service";
import type { TokenProvider } from "./vault.types";

const ADR_TEMPLATE =
  "---\ntitle: ADR\ntags: [adr]\nsource: manual\n---\n# ADR NNN — Title\n\n## Context\n\n## Decision\n\n## Consequences\n";

/**
 * Everything that touches the vault folder: save, trash, rename, history,
 * views, templates, and the commit → debounced push pipeline.
 * Emits `index`, `progress`, `sync`, `auth-expired`.
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
  };
  private pushTimer: NodeJS.Timeout | null = null;
  private pushing = false;
  private retryDelay = PUSH_RETRY_MIN_MS;

  constructor(
    readonly config: VaultConfig,
    cacheDir: string,
    private readonly tokenProvider: TokenProvider,
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
    void this.refreshSyncStatus();
    return snap;
  }

  async close(): Promise<void> {
    if (this.pushTimer) clearTimeout(this.pushTimer);
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
    const raw = await fs.readFile(join(this.root, relPath), "utf8");
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

    const isNew = !req.existingPath;
    const moved = !!req.existingPath && req.existingPath !== target;
    if (moved) await this.git.mv(req.existingPath!, target);
    await fs.writeFile(abs, composeDoc(fm, req.body, extra));

    const meta = (await this.index.refreshFile(target))!;
    if (moved) this.index.remove(req.existingPath!);

    let committed = false;
    if (req.commit) {
      const message = isNew
        ? `add: ${fm.title}`
        : moved
          ? `move: ${fm.title}`
          : `update: ${fm.title}`;
      await this.git.commitPaths([target], message);
      await this.writeReadme();
      await this.git.commitPaths([README_FILE], message, { amend: true });
      committed = true;
      this.schedulePush();
    }
    this.emit("index", this.index.snapshot());
    return { path: target, meta, committed };
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
  async trash(relPath: string): Promise<void> {
    const dest = `${TRASH_DIR}/${relPath}`;
    await fs.mkdir(dirname(join(this.root, dest)), { recursive: true });
    const title = this.index.get(relPath)?.title ?? relPath;
    await this.git.mv(relPath, dest);
    this.index.remove(relPath);
    await this.git.commitPaths([dest], `trash: ${title}`);
    await this.writeReadme();
    await this.git.commitPaths([README_FILE], "", { amend: true });
    this.schedulePush();
    this.emit("index", this.index.snapshot());
  }

  async history(relPath: string): Promise<CommitInfo[]> {
    return this.git.log(relPath);
  }

  async atCommit(relPath: string, sha: string): Promise<string> {
    return this.git.show(relPath, sha);
  }

  async restore(relPath: string, sha: string): Promise<SaveResult> {
    const { frontmatter, body } = parseDoc(await this.git.show(relPath, sha));
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
      try {
        await fs.rmdir(join(this.root, fromSlug));
      } catch {
        /* not empty (non-md files) — leave it */
      }
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
    const sticky =
      this.sync.state === "error" ||
      this.sync.state === "offline" ||
      this.sync.state === "conflict";
    const state: SyncStatus["state"] = sticky
      ? this.sync.state
      : ab.ahead > 0
        ? "pending"
        : "synced";
    this.setSync({ ...ab, state });
    return this.sync;
  }

  private async ensureRemote(): Promise<void> {
    if (!(await this.git.hasRemote()))
      await this.git.setRemote(`https://github.com/${this.config.remote}.git`);
  }

  async pushNow(): Promise<SyncStatus> {
    if (!this.config.remote || this.pushing) return this.sync;
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.pushing = true;
    this.setSync({ state: "pushing", lastError: null });
    try {
      await this.ensureRemote();
      try {
        await this.git.push();
      } catch (e) {
        // non fast-forward → rebase on top of the remote first
        if (!/rejected|non-fast-forward|fetch first/i.test(String((e as Error).message ?? e)))
          throw e;
        const conflicts = await this.git.pullRebase();
        if (conflicts.length) {
          this.setSync({
            state: "conflict",
            lastError: `${conflicts.length} file(s) changed on both machines`,
          });
          return this.sync;
        }
        await this.git.push();
      }
      this.retryDelay = PUSH_RETRY_MIN_MS;
      this.setSync({ state: "synced", lastPushAt: Date.now(), ahead: 0 });
      await this.index.markUnpushed(new Set());
      await this.refreshSyncStatus();
    } catch (e) {
      const msg = redact(String((e as Error).message ?? e), this.tokenProvider());
      const offline = /could not resolve|network|timed out|unable to access|connection/i.test(msg);
      const auth = /401|403|authentication|permission/i.test(msg);
      this.setSync({ state: auth ? "error" : offline ? "offline" : "error", lastError: msg });
      if (auth) this.emit("auth-expired");
      else {
        // back off and retry; the commit is safe on disk
        this.pushTimer = setTimeout(() => void this.pushNow(), this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, PUSH_RETRY_MAX_MS);
      }
    } finally {
      this.pushing = false;
    }
    return this.sync;
  }

  async pull(): Promise<{ conflicts: ConflictFile[] }> {
    if (!this.config.remote) return { conflicts: [] };
    await this.ensureRemote();
    const paths = await this.git.pullRebase();
    const conflicts: ConflictFile[] = [];
    for (const p of paths) {
      const abs = join(this.root, p);
      let ours = { words: 0, mtime: 0 };
      try {
        const st = await fs.stat(abs);
        ours = { words: countWords(await fs.readFile(abs, "utf8")), mtime: st.mtimeMs };
      } catch {
        /* deleted locally */
      }
      let theirs = { words: 0, mtime: 0 };
      try {
        theirs = {
          words: countWords(await this.git.show(p, `origin/${this.sync.branch}`)),
          mtime: 0,
        };
      } catch {
        /* not on remote */
      }
      conflicts.push({ path: p, ours, theirs });
    }
    if (!paths.length) {
      await this.index.rescan();
      await this.refreshSyncStatus();
    } else this.setSync({ state: "conflict" });
    return { conflicts };
  }

  /**
   * Resolve a rebase conflict. `mine` keeps this machine's version, `theirs` keeps the
   * remote, `both` keeps the remote at the path and saves mine as a copy. Nothing is
   * destroyed: the loser stays in git history.
   */
  async resolveConflict(relPath: string, choice: ConflictChoice): Promise<void> {
    const abs = join(this.root, relPath);
    if (choice === "both") {
      const raw = await fs.readFile(abs, "utf8");
      const mine = raw.replace(/<<<<<<<[^\n]*\n([\s\S]*?)=======\n[\s\S]*?>>>>>>>[^\n]*\n?/g, "$1");
      const copy = await this.uniquePath(relPath.replace(/\.md$/, "-this-mac.md"));
      await fs.writeFile(join(this.root, copy), mine);
      await this.git.checkoutSide(relPath, "ours");
      await this.git.git.add([copy]);
    } else {
      await this.git.checkoutSide(relPath, choice === "mine" ? "theirs" : "ours");
    }
    const status = await this.git.git.status();
    if (!status.conflicted.length) {
      await this.git.continueRebase();
      await this.index.rescan();
      this.setSync({ state: "pending", lastError: null });
      this.schedulePush();
    }
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

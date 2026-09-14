import { simpleGit, type SimpleGit } from "simple-git";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CommitInfo } from "@shared/types";
import { DEFAULT_BRANCH } from "@shared/constants";
import { relativeTime } from "@shared/helpers";
import type { AheadBehind, ChangedFile, ConflictSide, TokenProvider } from "./git.types";

/**
 * Thin wrapper around simple-git. The token is injected per-command through an
 * `http.extraheader` config flag so it never lands in `.git/config` or on disk.
 */
export class GitService {
  readonly git: SimpleGit;

  constructor(
    readonly root: string,
    private readonly tokenProvider: TokenProvider,
  ) {
    this.git = simpleGit({
      baseDir: root,
      binary: "git",
      maxConcurrentProcesses: 1,
      trimmed: true,
    });
  }

  private static authArgsFor(token: string | null): string[] {
    if (!token) return [];
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    // An explicit Authorization header wins over any credential helper, so none needs disabling
    // (simple-git refuses `-c credential.helper=` anyway).
    return ["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`];
  }

  /** Args that authenticate a single network command. */
  private authArgs(): string[] {
    return GitService.authArgsFor(this.tokenProvider());
  }

  static async isAvailable(): Promise<string | null> {
    try {
      const v = await simpleGit().version();
      return v.installed ? `${v.major}.${v.minor}.${v.patch}` : null;
    } catch {
      return null;
    }
  }

  static async clone(
    url: string,
    dest: string,
    token: string | null,
    branch?: string,
  ): Promise<void> {
    mkdirSync(dirname(dest), { recursive: true });
    const args = [...GitService.authArgsFor(token)];
    if (branch) args.push("--branch", branch);
    await simpleGit().clone(url, dest, args);
  }

  static async init(dest: string, branch = DEFAULT_BRANCH): Promise<void> {
    mkdirSync(dest, { recursive: true });
    if (!existsSync(`${dest}/.git`)) await simpleGit({ baseDir: dest }).init(["-b", branch]);
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  async ensureIdentity(name: string, email: string): Promise<void> {
    const cfg = await this.git.listConfig();
    if (!cfg.all["user.name"]) await this.git.addConfig("user.name", name);
    if (!cfg.all["user.email"]) await this.git.addConfig("user.email", email);
  }

  async headSha(): Promise<string | null> {
    try {
      return (await this.git.revparse(["HEAD"])).trim() || null;
    } catch {
      return null;
    }
  }

  async currentBranch(): Promise<string> {
    try {
      return (await this.git.revparse(["--abbrev-ref", "HEAD"])).trim() || "main";
    } catch {
      return "main";
    }
  }

  async hasRemote(): Promise<boolean> {
    return (await this.git.getRemotes(true)).some((r) => r.name === "origin");
  }

  async setRemote(url: string): Promise<void> {
    if (await this.hasRemote()) await this.git.remote(["set-url", "origin", url]);
    else await this.git.addRemote("origin", url);
  }

  /** Files changed between a commit and HEAD, with renames detected. */
  async changedSince(sha: string): Promise<ChangedFile[]> {
    const out = await this.git.raw(["diff", "--name-status", "-M", sha, "HEAD"]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("\t");
        const status = parts[0][0];
        if (status === "R" || status === "C") return { status, oldPath: parts[1], path: parts[2] };
        return { status, path: parts[1] };
      });
  }

  async commitPaths(
    paths: string[],
    message: string,
    opts: { amend?: boolean } = {},
  ): Promise<string> {
    if (paths.length) await this.git.add(paths);
    if (opts.amend) {
      await this.git.raw(["commit", "--amend", "--no-edit", "--quiet"]);
      return (await this.headSha()) ?? "";
    }
    return (await this.git.commit(message)).commit;
  }

  async commitAll(message: string): Promise<string> {
    await this.git.add(["-A"]);
    return (await this.git.commit(message)).commit;
  }

  /** `git rm -r` a folder (tracked files only; untracked ones are the caller's to remove). */
  async removeTree(path: string): Promise<void> {
    await this.git.raw(["rm", "-r", "-q", "--ignore-unmatch", "--", path]);
  }

  /** Stages `from` first so untracked (never-committed) files can be moved too. */
  async mv(from: string, to: string): Promise<void> {
    await this.git.add([from]);
    await this.git.mv(from, to);
  }

  async aheadBehind(): Promise<AheadBehind> {
    try {
      const branch = await this.currentBranch();
      const out = await this.git.raw([
        "rev-list",
        "--left-right",
        "--count",
        `${branch}...origin/${branch}`,
      ]);
      const [a, b] = out.trim().split(/\s+/).map(Number);
      return { ahead: a || 0, behind: b || 0 };
    } catch {
      // no upstream yet: everything is "ahead"
      try {
        const n = Number((await this.git.raw(["rev-list", "--count", "HEAD"])).trim());
        return { ahead: n, behind: 0 };
      } catch {
        return { ahead: 0, behind: 0 };
      }
    }
  }

  async fetch(): Promise<void> {
    await this.git.raw([...this.authArgs(), "fetch", "origin", "--prune"]);
  }

  async push(): Promise<void> {
    const branch = await this.currentBranch();
    await this.git.raw([...this.authArgs(), "push", "-u", "origin", branch]);
  }

  /**
   * Rebase local commits onto origin. Returns conflicted paths (empty = clean).
   * A failure that left nothing conflicted was not a conflict — it was the network, or
   * auth, or a repo that isn't there — so it is re-thrown rather than read as success.
   */
  async pullRebase(): Promise<string[]> {
    const branch = await this.currentBranch();
    try {
      await this.git.raw([...this.authArgs(), "pull", "--rebase", "--autostash", "origin", branch]);
      return [];
    } catch (e) {
      const conflicted = await this.conflictedPaths();
      if (!conflicted.length) throw e;
      return conflicted;
    }
  }

  async abortRebase(): Promise<void> {
    try {
      await this.git.rebase(["--abort"]);
    } catch {
      /* not rebasing */
    }
  }

  /**
   * Finish the commit a rebase stopped on, with every conflicted path already staged.
   *
   * `rebase --continue` opens an editor for the message even when there is nothing to
   * decide, and simple-git blocks both ways of silencing one: `-c core.editor=true` is
   * refused outright, and setting `GIT_EDITOR` means handing it a whole environment,
   * which trips its `GIT_SSH_COMMAND` guard. So the commit is made here instead —
   * `--no-edit` takes the message the rebase already prepared — and `--continue` then
   * has nothing left to write and no editor to open. This is the documented path: git's
   * own message says "If you have committed the changes yourself, run rebase --continue".
   *
   * Resolving to exactly what upstream already has leaves an empty commit, which git
   * refuses; that is what `--skip` is for.
   */
  async continueRebase(): Promise<void> {
    try {
      await this.git.raw(["commit", "--no-edit"]);
    } catch {
      /* nothing left to commit — --continue or --skip below decides which */
    }
    try {
      await this.git.raw(["rebase", "--continue"]);
    } catch (e) {
      if (!/no changes|nothing to commit|did you forget/i.test(String((e as Error).message ?? e)))
        throw e;
      await this.git.raw(["rebase", "--skip"]);
    }
  }

  /**
   * Which stage in the index holds which side of a conflict.
   *
   * A rebase replays YOUR commits on top of the remote's, so the roles are the reverse
   * of a merge: stage 2 ("ours", `--ours`) is the REMOTE, stage 3 ("theirs", `--theirs`)
   * is yours. Getting this backwards is the classic rebase mistake — and it is not
   * hypothetical, an earlier version of this file made it — so nothing below is allowed
   * to say "ours" or "theirs". Sides are named for where the content came from, and the
   * one place the git words appear is here.
   */
  private static STAGE = { remote: 2, mine: 3 } as const;

  /** One side of a conflicted file, read from the index. `null` = that side deleted it. */
  async conflictSide(path: string, side: ConflictSide): Promise<string | null> {
    try {
      return await this.git.raw(["show", `:${GitService.STAGE[side]}:${path}`]);
    } catch {
      return null;
    }
  }

  /** Resolve a conflicted path to one side, staged and ready for `rebase --continue`. */
  async takeSide(path: string, side: ConflictSide): Promise<void> {
    await this.git.raw(["checkout", side === "remote" ? "--ours" : "--theirs", "--", path]);
    await this.git.add([path]);
  }

  /** True while a rebase is stopped part-way — after a crash, or between conflicts. */
  rebaseInProgress(): boolean {
    return (
      existsSync(`${this.root}/.git/rebase-merge`) || existsSync(`${this.root}/.git/rebase-apply`)
    );
  }

  /** Paths still conflicted right now. */
  async conflictedPaths(): Promise<string[]> {
    return (await this.git.status()).conflicted;
  }

  async log(path: string, max = 50): Promise<CommitInfo[]> {
    const SEP = "\u001f";
    // `--name-only` alongside `--follow` gives the name the file had in each commit,
    // which is what `show` and `diff` below must be asked for.
    const out = await this.git.raw([
      "log",
      `--max-count=${max}`,
      "--follow",
      "--name-only",
      `--format=${SEP}%H${SEP}%aI${SEP}%an${SEP}%s`,
      "--",
      path,
    ]);
    const commits: CommitInfo[] = [];
    for (const line of out.split("\n")) {
      if (line.startsWith(SEP)) {
        const [, sha, date, author, message] = line.split(SEP);
        commits.push({
          sha,
          shortSha: sha.slice(0, 7),
          message,
          date,
          relative: relativeTime(date),
          author,
          path,
        });
      } else if (line.trim() && commits.length) {
        // The first name under a commit is this file's name in it.
        const current = commits[commits.length - 1];
        if (current.path === path) current.path = line.trim();
      }
    }
    return commits;
  }

  async show(path: string, sha: string): Promise<string> {
    return this.git.show([`${sha}:${path}`]);
  }

  /**
   * What one commit did to one file, as a unified diff. `show` rather than `diff A^ B`
   * so a root commit — which has no parent — renders as all-additions instead of failing.
   */
  async diff(path: string, sha: string): Promise<string> {
    return this.git.raw(["show", "--format=", "--unified=3", sha, "--", path]);
  }

  /** Paths with commits not on origin. */
  async unpushedPaths(): Promise<Set<string>> {
    try {
      const branch = await this.currentBranch();
      const out = await this.git.raw(["diff", "--name-only", `origin/${branch}...HEAD`]);
      return new Set(out.split("\n").filter(Boolean));
    } catch {
      return new Set();
    }
  }
}

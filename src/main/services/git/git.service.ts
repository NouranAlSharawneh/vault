import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { simpleGit, type SimpleGit, type SimpleGitOptions } from "simple-git";
import { DEFAULT_BRANCH } from "@shared/constants";
import { relativeTime } from "@shared/helpers";
import type { CommitInfo } from "@shared/types";
import { gitBinary } from "./git-status.service";
import type { AheadBehind, ChangedFile, ConflictSide, TokenProvider } from "./git.types";
import { LOG_SEP, parseLogPatch } from "./parse-log-patch";
import { RepoLock } from "./repo-lock";

/** An `index.lock` older than this, found while the vault opens, was left by a crash. */
const STALE_LOCK_MS = 60_000;

/** The characters simple-git accepts in a binary path without being told it's deliberate. */
const PLAIN_BINARY = /^([a-z]:)?([a-z0-9/.\\_~-]+)$/i;

/**
 * Options for every simple-git instance: the git detection settled on, rather than
 * whatever `git` means on a PATH a Finder-launched app barely has. A path with a space in
 * it trips simple-git's injection guard; ours came from detection or a file dialog, never
 * from a document, so it is allowed through.
 */
function gitOptions(baseDir?: string): Partial<SimpleGitOptions> {
  const binary = gitBinary();

  return {
    ...(baseDir ? { baseDir } : {}),
    binary,
    unsafe: { allowUnsafeCustomBinary: !PLAIN_BINARY.test(binary) },
    // Paths come back as written, not octal-escaped: an Arabic title was printed as
    // `"_inbox/\330\271…"`, so history, restore and the unpushed marker never matched it.
    config: ["core.quotepath=false"],
  };
}

/**
 * Thin wrapper around simple-git. The token is injected per-command through an
 * `http.extraheader` config flag so it never lands in `.git/config` or on disk.
 */
export class GitService {
  readonly git: SimpleGit;
  /**
   * One at a time for every operation that takes more than one git command. simple-git
   * already runs single commands in turn; a save is `add → commit → write README → add →
   * amend`, and a push or pull landing in the middle of that rewrote a pushed commit or
   * folded a save into someone else's rebase.
   */
  private readonly lock = new RepoLock();

  constructor(
    readonly root: string,
    private readonly tokenProvider: TokenProvider,
  ) {
    this.git = simpleGit({ ...gitOptions(root), maxConcurrentProcesses: 1, trimmed: true });
  }

  /** Run `work` once nothing else is changing the repo. See `lock`. */
  exclusive<T>(work: () => Promise<T>): Promise<T> {
    return this.lock.run(work);
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

  static async clone(
    url: string,
    dest: string,
    token: string | null,
    branch?: string,
  ): Promise<void> {
    mkdirSync(dirname(dest), { recursive: true });
    const args = [...GitService.authArgsFor(token)];
    if (branch) args.push("--branch", branch);
    await simpleGit(gitOptions()).clone(url, dest, args);
  }

  /** True when the remote answers and has no branches at all — a repo made but never pushed. */
  static async remoteIsEmpty(url: string, token: string | null): Promise<boolean> {
    try {
      const out = await simpleGit(gitOptions()).raw([
        ...GitService.authArgsFor(token),
        "ls-remote",
        "--heads",
        url,
      ]);

      return !out.trim();
    } catch {
      return false;
    }
  }

  /** The `origin` URL of the repo at `dir`, or null when it has none. */
  static async originOf(dir: string): Promise<string | null> {
    try {
      return (await simpleGit(gitOptions(dir)).remote(["get-url", "origin"]))?.trim() || null;
    } catch {
      return null;
    }
  }

  static async init(dest: string, branch = DEFAULT_BRANCH): Promise<void> {
    mkdirSync(dest, { recursive: true });
    if (!existsSync(`${dest}/.git`)) await simpleGit(gitOptions(dest)).init(["-b", branch]);
  }

  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }

  /**
   * Remove an `index.lock` a crash or a power cut left behind. Nothing of ours is running
   * git while the vault opens, and a lock that old belongs to no one: left there, every
   * save, pull and push failed with "Unable to create index.lock: File exists".
   */
  async clearStaleLock(maxAgeMs = STALE_LOCK_MS): Promise<void> {
    const lock = join(this.root, ".git", "index.lock");
    try {
      if (Date.now() - statSync(lock).mtimeMs > maxAgeMs) rmSync(lock, { force: true });
    } catch {
      /* no lock */
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
      const name = (await this.git.revparse(["--abbrev-ref", "HEAD"])).trim();
      // Mid-rebase HEAD is detached and git answers "HEAD": the branch being rebased is
      // written down in the rebase's own state. Pushing "HEAD" failed, and counting
      // against `origin/HEAD` called every commit in the repo unpushed.
      if (name === "HEAD") return this.rebasingBranch() ?? DEFAULT_BRANCH;

      return name || DEFAULT_BRANCH;
    } catch {
      return DEFAULT_BRANCH;
    }
  }

  private rebasingBranch(): string | null {
    for (const dir of ["rebase-merge", "rebase-apply"]) {
      try {
        const ref = readFileSync(join(this.root, ".git", dir, "head-name"), "utf8").trim();
        if (ref.startsWith("refs/heads/")) return ref.slice("refs/heads/".length);
      } catch {
        /* not this kind of rebase */
      }
    }

    return null;
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

  async commitPaths(paths: string[], message: string): Promise<string> {
    if (paths.length) await this.git.add(paths);

    return (await this.git.commit(message)).commit;
  }

  /**
   * Fold more paths into the commit that was just made, keeping its message. Used for
   * the regenerated README, which belongs to the change that caused it rather than to a
   * commit of its own — a vault's history should read as the documents, not as the
   * index being rewritten after every one of them.
   */
  async amendPaths(paths: string[]): Promise<string> {
    if (paths.length) await this.git.add(paths);
    await this.git.raw(["commit", "--amend", "--no-edit", "--quiet"]);

    return (await this.headSha()) ?? "";
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

  /**
   * `git add -A` limited to these paths, skipping any that neither exist nor are tracked —
   * git refuses the whole command over one pathspec that matches nothing.
   */
  async stage(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const tracked = (await this.git.raw(["ls-files", "-z", "--", ...paths]))
      .split("\0")
      .filter(Boolean);
    const live = paths.filter(
      (p) =>
        existsSync(join(this.root, p)) || tracked.some((t) => t === p || t.startsWith(`${p}/`)),
    );
    if (live.length) await this.git.raw(["add", "-A", "--", ...live]);
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

  /**
   * Paths the autostash could not put back after a pull that otherwise succeeded. git
   * exits 0 here, leaves conflict markers in the file and the edit in `stash@{0}`, and
   * every later commit fails on the unmerged path. Only meaningful with no rebase running.
   */
  async autostashConflicts(): Promise<string[]> {
    return this.rebaseInProgress() ? [] : this.conflictedPaths();
  }

  /** Drop the stash git kept after a conflicted autostash, once its text is back on disk. */
  async dropAutostash(): Promise<void> {
    try {
      const top = await this.git.raw(["stash", "list", "-1", "--format=%gs"]);
      if (/autostash/i.test(top)) await this.git.raw(["stash", "drop", "--quiet"]);
    } catch {
      /* no stash */
    }
  }

  /** Put a conflicted path's index back to HEAD, leaving whatever is on disk alone. */
  async unstage(path: string): Promise<void> {
    await this.git.raw(["reset", "-q", "--", path]);
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

  /**
   * One side of a conflicted file, read from the index as bytes. `null` = that side
   * deleted it. Bytes, not text: the instance trims its output, which stripped a doc's
   * leading indent and turned an image into mojibake when it was written back.
   */
  async conflictSide(path: string, side: ConflictSide): Promise<Buffer | null> {
    try {
      return await this.git.showBuffer([`:${GitService.STAGE[side]}:${path}`]);
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

  /**
   * A page of a file's commits with what each one did to it — lines added and removed,
   * and whether only its metadata changed — from one `log -p` rather than a call per
   * commit. `skip` pages further back than the first `max`.
   */
  async logStats(path: string, max: number, skip = 0): Promise<CommitInfo[]> {
    const out = await this.git.raw([
      "log",
      `--max-count=${max}`,
      `--skip=${skip}`,
      "--follow",
      "-M",
      "-p",
      "--unified=0",
      `--format=${LOG_SEP}%H${LOG_SEP}%aI${LOG_SEP}%an${LOG_SEP}%s`,
      "--",
      path,
    ]);

    return parseLogPatch(out, path);
  }

  /**
   * How the file on disk differs from what it was at `sha`. Both names are passed — the
   * one it had then and the one it has now — so a document moved since reads as edited,
   * not as one file deleted and another added.
   */
  async compare(paths: string[], sha: string): Promise<string> {
    return this.git.raw(["diff", "-M", "--unified=3", sha, "--", ...paths]);
  }

  /** A file's text at a commit, untrimmed — a restore must bring back every byte. */
  async show(path: string, sha: string): Promise<string> {
    return (await this.git.showBuffer([`${sha}:${path}`])).toString("utf8");
  }

  /**
   * What one commit did to one file, as a unified diff. `show` rather than `diff A^ B`
   * so a root commit — which has no parent — renders as all-additions instead of failing.
   */
  async diff(paths: string[], sha: string): Promise<string> {
    return this.git.raw(["show", "--format=", "-M", "--unified=3", sha, "--", ...paths]);
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

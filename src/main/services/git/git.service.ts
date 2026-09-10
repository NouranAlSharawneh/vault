import { simpleGit, type SimpleGit } from "simple-git";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CommitInfo } from "@shared/types";
import { DEFAULT_BRANCH } from "@shared/constants";
import { relativeTime } from "@shared/helpers";
import type { AheadBehind, ChangedFile, TokenProvider } from "./git.types";

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
    return [
      "-c",
      `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`,
      "-c",
      "credential.helper=",
    ];
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
    await this.git.add(paths);
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

  /** Rebase local commits onto origin. Returns conflicted paths (empty = clean). */
  async pullRebase(): Promise<string[]> {
    const branch = await this.currentBranch();
    try {
      await this.git.raw([...this.authArgs(), "pull", "--rebase", "--autostash", "origin", branch]);
      return [];
    } catch {
      return (await this.git.status()).conflicted;
    }
  }

  async abortRebase(): Promise<void> {
    try {
      await this.git.rebase(["--abort"]);
    } catch {
      /* not rebasing */
    }
  }

  async continueRebase(): Promise<void> {
    await this.git.raw(["-c", "core.editor=true", "rebase", "--continue"]);
  }

  /** During a rebase "ours" is upstream and "theirs" is the local commit being replayed. */
  async checkoutSide(path: string, side: "ours" | "theirs"): Promise<void> {
    await this.git.raw(["checkout", side === "ours" ? "--theirs" : "--ours", "--", path]);
    await this.git.add([path]);
  }

  async log(path: string, max = 50): Promise<CommitInfo[]> {
    const SEP = "\u001f";
    const out = await this.git.raw([
      "log",
      `--max-count=${max}`,
      "--follow",
      `--format=%H${SEP}%aI${SEP}%an${SEP}%s`,
      "--",
      path,
    ]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, date, author, message] = line.split(SEP);
        return {
          sha,
          shortSha: sha.slice(0, 7),
          message,
          date,
          relative: relativeTime(date),
          author,
        };
      });
  }

  async show(path: string, sha: string): Promise<string> {
    return this.git.show([`${sha}:${path}`]);
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

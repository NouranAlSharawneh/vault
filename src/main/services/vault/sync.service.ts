import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_BRANCH,
  FROM_REMOTE_SUFFIX,
  PULL_INTERVAL_MS,
  PUSH_RETRY_MAX_MS,
  PUSH_RETRY_MIN_MS,
  README_FILE,
  REBASE_MAX_STOPS,
} from "@shared/constants";
import { composeDoc, parseDoc } from "@shared/frontmatter";
import { inferTitle } from "@shared/helpers";
import type { Frontmatter, PullResult, SyncStatus } from "@shared/types";
import { fire } from "../../lib/fire";
import { freeRelPath } from "../fs/paths";
import { classifyPushError } from "./classify-push-error";
import type { SyncHost, TokenProvider } from "./vault.types";

/**
 * Everything that touches the remote, and all of the vault's mutable state.
 *
 * It lives apart for two reasons. It is the only part with timers, a queue and a retry
 * schedule — the only part where two things can be true at once, which is where every
 * sync defect the audit found came from. And it needs nothing from the vault but the
 * repo, the index, the config and a way to say something changed: that is `SyncHost`.
 */
export class SyncEngine {
  private sync: SyncStatus = {
    state: "synced",
    ahead: 0,
    behind: 0,
    branch: DEFAULT_BRANCH,
    lastPushAt: null,
    lastError: null,
    remote: null,
    conflicts: 0,
    failure: null,
    failedOp: null,
  };

  private pushTimer: NodeJS.Timeout | null = null;
  private pullTimer: NodeJS.Timeout | null = null;
  private pushing = false;
  private pullInFlight: Promise<PullResult> | null = null;
  private retryDelay = PUSH_RETRY_MIN_MS;
  /**
   * Set once the vault closes. A push that was mid-flight used to re-arm its retry timer
   * after `stop()`, so a closed vault kept pushing — beside the one that replaced it.
   */
  private stopped = false;

  constructor(
    private readonly v: SyncHost,
    private readonly tokenProvider: TokenProvider,
    /**
     * Renew an expiring token before we use it. Without this the first push past the
     * token's deadline fails in the user's face before recovery kicks in.
     */
    private readonly freshenToken: () => Promise<void>,
  ) {}

  /** The vault is open: adopt its branch and remote, then start the quiet fetch. */
  start(branch: string, remote: string | null): void {
    this.sync.branch = branch;
    this.sync.remote = remote;

    // Anything committed but never pushed — quit inside the debounce, or written while
    // offline — would otherwise sit there forever, because the only thing that ever
    // pushes is another save.
    fire(
      this.refreshSyncStatus().then((s) => {
        if (s.ahead > 0) this.schedulePush();
      }),
      "checking what still needs pushing",
    );
    this.startPulling();
  }

  stop(): void {
    this.stopped = true;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pullTimer) clearInterval(this.pullTimer);
    this.pushTimer = null;
    this.pullTimer = null;
  }

  /**
   * Push now whatever is waiting on the debounce, for a quit. Clearing the timer used to
   * be all a quit did, so a save made in the last few seconds stayed on this machine.
   */
  async flush(): Promise<void> {
    if (!this.v.config.remote || this.stopped) return;
    const waiting = this.pushTimer !== null || this.sync.state === "pending";
    if (!waiting) return;
    await this.pushNow();
  }

  /**
   * A quiet fetch on a long interval. Without it a document written on another machine —
   * or on github.com — never reaches this one until you happen to save something here,
   * because only a push ever goes to the network. An interrupted rebase from a previous
   * run is also cleaned up by the first tick.
   */
  private startPulling(): void {
    if (!this.v.config.remote || this.pullTimer) return;
    this.pullTimer = setInterval(() => fire(this.pull(), "the scheduled pull"), PULL_INTERVAL_MS);
    // Node keeps the process alive for a pending timer; a background fetch should not.
    this.pullTimer.unref?.();
    fire(this.pull(), "the first pull");
  }

  status(): SyncStatus {
    return this.sync;
  }

  setSync(patch: Partial<SyncStatus>): void {
    this.sync = { ...this.sync, ...patch };
    this.v.emit("sync", this.sync);
  }

  /** PRD Q6: commit immediately, push on a short debounce. */
  schedulePush(): void {
    if (!this.v.config.remote || this.stopped) return;
    this.setSync({ state: "pending" });
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(
      () => fire(this.pushNow(), "the debounced push"),
      this.v.config.pushDebounceMs,
    );
    // The count and the amber "not pushed" marks follow the commit that was just made,
    // not the next push — a doc saved offline used to show neither.
    fire(this.refreshSyncStatus(), "counting what is waiting to push");
  }

  async refreshSyncStatus(): Promise<SyncStatus> {
    // With no upstream, `aheadBehind` counts every commit as unpushed — right for a repo
    // about to make its first push, nonsense for a vault that never pushes at all.
    const ab = this.v.config.remote ? await this.v.git.aheadBehind() : { ahead: 0, behind: 0 };
    await this.v.index.markUnpushed(await this.v.git.unpushedPaths());
    // Counted off the documents themselves rather than remembered, so it survives a
    // restart with a pair still unanswered and clears itself the moment the last one is
    // settled. Error and offline stay sticky until something changes them, and a push
    // under way says so until it finishes — a count taken beside it is not its result.
    const conflicts = (await this.v.conflicts()).length;
    const sticky = ["error", "offline", "pushing"].includes(this.sync.state);
    const state: SyncStatus["state"] = sticky
      ? this.sync.state
      : ab.ahead > 0
        ? "pending"
        : "synced";
    this.setSync({ ...ab, state, conflicts });

    return this.sync;
  }

  private async ensureRemote(): Promise<void> {
    if (!(await this.v.git.hasRemote()))
      await this.v.git.setRemote(`https://github.com/${this.v.config.remote}.git`);
  }

  /**
   * One queue for everything that touches the remote — and, since it is the repo's own
   * lock, for every save, trash and restore as well.
   *
   * A push and a pull both drive a rebase, and each was guarded only against a second of
   * its own kind. Run together — which the interval timer and a save do without trying —
   * one of them finished the other's rebase and the loser reported `fatal: No rebase in
   * progress?`. A save landing mid-rebase was folded into a replayed commit. They cannot
   * overlap now.
   */
  private queue<T>(work: () => Promise<T>): Promise<T> {
    return this.v.git.exclusive(work);
  }

  async pushNow(): Promise<SyncStatus> {
    if (!this.v.config.remote) return this.sync;

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
        await this.v.git.push();
      } catch (e) {
        // non fast-forward → rebase on top of the remote first
        if (!/rejected|non-fast-forward|fetch first/i.test(String((e as Error).message ?? e)))
          throw e;
        // Both versions are kept and committed, so the push that follows carries them
        // both up. It never stops here waiting for an answer.
        const head = await this.v.git.headSha();
        const conflicted = await this.v.git.pullRebase();
        if (conflicted.length) await this.settleRebase(conflicted);
        await this.settleAutostash();
        if ((await this.v.git.headSha()) !== head) {
          await this.v.index.rescan();
          this.v.emit("index", this.v.index.snapshot());
        }
        await this.v.git.push();
      }
      this.retryDelay = PUSH_RETRY_MIN_MS;
      this.v.emit("auth-ok");
      this.setSync({
        state: "synced",
        lastPushAt: Date.now(),
        ahead: 0,
        failure: null,
        failedOp: null,
        lastError: null,
      });
      await this.v.index.markUnpushed(new Set());
      await this.refreshSyncStatus();
    } catch (e) {
      // A rebase that stopped for anything but a conflict was left half-done here, on a
      // detached HEAD: saves then committed onto it, and a later abort threw them away.
      if (this.v.git.rebaseInProgress()) await this.v.git.abortRebase();
      const msg = redact(String((e as Error).message ?? e), this.tokenProvider());
      const failure = classifyPushError(msg);
      this.setSync({
        state: failure === "offline" ? "offline" : "error",
        lastError: msg,
        failure,
        failedOp: "push",
      });
      fire(this.refreshSyncStatus(), "counting what is waiting to push");
      // Neither a dead token, a read-only repo nor a commit GitHub turned away is fixed by
      // asking again, so none is retried; the status carries which one it was, so the user
      // is told the right fix. Only a dead token is worth the session's check: a read-only
      // repo passes it, and the session then pushed again, failed again and checked again.
      if (failure === "bad-credentials") this.v.emit("auth-suspect");
      else if (
        failure !== "no-permission" &&
        failure !== "blocked" &&
        failure !== "not-found" &&
        !this.stopped
      ) {
        // back off and retry; the commit is safe on disk
        this.pushTimer = setTimeout(
          () => fire(this.pushNow(), "the retried push"),
          this.retryDelay,
        );
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
  async pull(): Promise<PullResult> {
    if (!this.v.config.remote) return { conflicts: [], pulled: 0, failure: null };
    // Asking for a pull while one is already running joins it rather than being told
    // "nothing happened" — the timer and a button press land on the same answer.
    if (!this.pullInFlight) {
      this.pullInFlight = this.queue(() => this.runPull());
      fire(
        this.pullInFlight.finally(() => {
          this.pullInFlight = null;
        }),
        "the pull that just finished",
      );
    }

    return this.pullInFlight;
  }

  private async runPull(): Promise<PullResult> {
    try {
      await this.freshenToken();
      await this.ensureRemote();
      const before = await this.remoteHead();
      const head = await this.v.git.headSha();
      // A rebase left over from a crash has to finish before a new one can start.
      if (this.v.git.rebaseInProgress()) await this.settleRebase();
      else {
        const conflicted = await this.v.git.pullRebase();
        if (conflicted.length) await this.settleRebase(conflicted);
        await this.settleAutostash();
      }
      // Nothing came down: the index is already right. Rescanning anyway every five
      // minutes emptied it for the length of a full walk, and anything that read it then —
      // a search, a README regenerated by a save — saw a vault with half its documents.
      if ((await this.v.git.headSha()) !== head) {
        await this.v.index.rescan();
        this.v.emit("index", this.v.index.snapshot());
      }
      this.clearPullFailure();
      await this.refreshSyncStatus();

      return {
        conflicts: await this.v.conflicts(),
        pulled: await this.countSince(before),
        failure: null,
      };
    } catch (e) {
      // Whatever went wrong, do not leave the vault half-rebased: the next save would
      // commit onto a detached HEAD and the user would have no way to see why.
      await this.v.git.abortRebase();
      const msg = redact(String((e as Error).message ?? e), this.tokenProvider());
      const failure = classifyPushError(msg);
      if (failure === "bad-credentials") this.v.emit("auth-suspect");
      // A failed pull must not paper over a failed push, which says more about what to do.
      if (this.sync.failedOp !== "push" || failure === "offline")
        this.setSync({
          state: failure === "offline" ? "offline" : "error",
          lastError: msg,
          failure,
          failedOp: "pull",
        });

      return { conflicts: [], pulled: 0, failure };
    }
  }

  /**
   * A pull just worked, so whatever the last pull complained about is over — and being
   * offline is over for pushes too. Only a successful push used to clear either, and a
   * push only happens after a save: a laptop that woke before its Wi-Fi said "offline"
   * until you wrote something.
   */
  private clearPullFailure(): void {
    const wasOffline = this.sync.failure === "offline";
    if (this.sync.failedOp !== "pull" && !wasOffline) return;
    this.setSync({
      state: this.sync.ahead > 0 ? "pending" : "synced",
      lastError: null,
      failure: null,
      failedOp: null,
    });
    if (wasOffline && this.sync.ahead > 0) this.schedulePush();
  }

  /** Where this machine last saw GitHub's branch, or null before it has seen it at all. */
  private async remoteHead(): Promise<string | null> {
    try {
      const ref = `origin/${this.sync.branch}`;

      return (await this.v.git.git.raw(["rev-parse", "--verify", "--quiet", ref])).trim() || null;
    } catch {
      return null;
    }
  }

  /** Commits GitHub's branch gained since `before`, i.e. what the pull brought down. */
  private async countSince(before: string | null): Promise<number> {
    const after = await this.remoteHead();
    if (!after || after === before) return 0;
    try {
      const range = before ? `${before}..${after}` : after;

      return Number((await this.v.git.git.raw(["rev-list", "--count", range])).trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Carry a rebase to the end, keeping both sides of every conflict it stops on. A rebase
   * replays each local commit in turn, so it can stop more than once — hence the loop.
   */
  private async settleRebase(first?: string[]): Promise<void> {
    let conflicted = first ?? (await this.v.git.conflictedPaths());
    for (let i = 0; this.v.git.rebaseInProgress() && i < REBASE_MAX_STOPS; i++) {
      if (conflicted.length) await this.keepBothSides(conflicted);
      await this.v.git.continueRebase();
      conflicted = await this.v.git.conflictedPaths();
    }
    if (this.v.git.rebaseInProgress()) throw new Error("Rebase did not finish");
  }

  /**
   * Resolve every conflicted path without asking and without losing anything: this
   * machine's version stays where it is, and the version from GitHub is written beside it
   * as its own document, stamped so the pair can be found again.
   */
  private async keepBothSides(paths: string[]): Promise<void> {
    for (const path of paths) {
      const mine = await this.v.git.conflictSide(path, "mine");
      const remote = await this.v.git.conflictSide(path, "remote");
      // The README is generated from the index, so there is nothing to choose between.
      if (path === README_FILE) {
        await this.v.git.takeSide(path, mine === null ? "remote" : "mine");
        continue;
      }
      // One side deleted it. Keeping the surviving text is the only non-destructive move.
      if (mine === null || remote === null) {
        await this.v.git.takeSide(path, mine === null ? "remote" : "mine");
        continue;
      }
      await this.v.git.takeSide(path, "mine");
      await this.v.git.git.add([await this.writeRemoteCopy(path, remote)]);
    }
  }

  /**
   * The version from GitHub, written beside its twin. A document gets the conflict stamp
   * so the pair can be found again; anything else — an image, a PDF — is kept by bytes
   * under a name that says where it came from.
   */
  private async writeRemoteCopy(path: string, remote: Buffer): Promise<string> {
    const copy = this.uniqueSibling(path, FROM_REMOTE_SUFFIX);
    if (!path.endsWith(".md")) {
      await fs.writeFile(join(this.v.root, copy), remote);

      return copy;
    }
    const parsed = parseDoc(remote.toString("utf8"));
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
    await fs.writeFile(join(this.v.root, copy), composeDoc(fm, parsed.body, parsed.extra));

    return copy;
  }

  /**
   * Put back what the autostash couldn't. An edit that was on disk but not committed —
   * a "save without committing", a change made in another editor — collided with what
   * came down: git exited 0, left conflict markers in the file and the edit in the stash,
   * and every commit after that failed on the unmerged path.
   *
   * The edit goes back on disk exactly as it was, still uncommitted. GitHub's version is
   * already committed underneath it; for a document it is also written beside it as a
   * stamped copy, so the pair turns up in the conflict sheet instead of one quietly
   * replacing the other the next time the file is saved.
   */
  private async settleAutostash(): Promise<void> {
    const paths = await this.v.git.autostashConflicts();
    if (!paths.length) return;
    const copies: string[] = [];
    for (const path of paths) {
      const mine = await this.v.git.conflictSide(path, "mine");
      const remote = await this.v.git.conflictSide(path, "remote");
      await this.v.git.unstage(path);
      const abs = join(this.v.root, path);
      if (path === README_FILE || mine === null) {
        // The README is regenerated anyway; a local delete loses to GitHub's text.
        if (remote) await fs.writeFile(abs, remote);
        continue;
      }
      await fs.writeFile(abs, mine);
      if (remote && path.endsWith(".md")) copies.push(await this.writeRemoteCopy(path, remote));
    }
    if (copies.length) await this.v.git.commitPaths(copies, "conflict: keep both");
    await this.v.git.dropAutostash();
  }

  /** When the version on GitHub was written, for "GitHub · today 14:29". */
  private async remoteDateFor(path: string): Promise<string> {
    try {
      const out = await this.v.git.git.raw([
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

  private uniqueSibling(path: string, suffix: string): string {
    const dot = path.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [path.slice(0, dot), path.slice(dot)] : [path, ""];

    return freeRelPath(this.v.root, `${stem}${suffix}${ext}`);
  }

  /** Every pair of versions still waiting on a decision, newest arrival first. */
}

/** Never let a token reach a message a person or a log will see. */
function redact(msg: string, token: string | null): string {
  return token ? msg.split(token).join("•••") : msg;
}

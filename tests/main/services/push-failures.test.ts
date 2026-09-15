import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncEngine } from "@main/services/vault/sync.service";
import type { SyncHost } from "@main/services/vault/vault.types";
import { PUSH_RETRY_MAX_MS, PUSH_RETRY_MIN_MS } from "@shared/constants";

/**
 * What happens after `git push` fails. The real sync test drives a bare origin end to
 * end; this one is about the branch the network cannot be asked to take on demand — a
 * revoked token, a repo gone read-only, a rate limit, a dead connection — so the push
 * itself is the only thing faked, and the retry schedule runs on fake timers.
 */
function engine(pushFails: () => Error | null) {
  const events: { name: string; payload?: unknown }[] = [];
  // One commit is waiting until a push carries it up, which is what makes the status
  // read "pending" before and "synced" after.
  let ahead = 1;
  const git = {
    push: vi.fn(async () => {
      const e = pushFails();
      if (e) throw e;
      ahead = 0;
    }),
    hasRemote: async () => true,
    setRemote: vi.fn(),
    aheadBehind: async () => ({ ahead, behind: 0 }),
    unpushedPaths: async () => new Set<string>(),
    pullRebase: vi.fn(async () => []),
  };
  const host = {
    config: { remote: "nunu/vault" },
    root: "/vault",
    git,
    index: { markUnpushed: vi.fn(async () => undefined), rescan: vi.fn(), snapshot: () => ({}) },
    emit: (name: string, payload?: unknown) => {
      events.push({ name, payload });

      return true;
    },
    conflicts: async () => [],
  } as unknown as SyncHost;

  const sync = new SyncEngine(
    host,
    () => "gho_secret_token",
    async () => undefined,
  );

  return { sync, git, events, said: (n: string) => events.some((e) => e.name === n) };
}

const boom = (message: string) => (): Error => new Error(message);

describe("a push that fails", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("asks whether the token is still good when GitHub says 401", async () => {
    const { sync, events } = engine(
      boom("remote: Invalid credentials\nfatal: Authentication failed"),
    );
    await sync.pushNow();

    expect(events.some((e) => e.name === "auth-suspect")).toBe(true);
    expect(sync.status().state).toBe("error");
  });

  it("asks the same question when the repo is readable but not writable", async () => {
    const { sync, said } = engine(boom("remote: Permission to nunu/vault.git denied to nunu"));
    await sync.pushNow();

    expect(said("auth-suspect")).toBe(true);
  });

  it("does not schedule a retry for a credential problem — retrying cannot fix it", async () => {
    const { sync, git } = engine(boom("fatal: Authentication failed for 'https://github.com'"));
    await sync.pushNow();
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MAX_MS * 2);

    expect(git.push).toHaveBeenCalledTimes(1);
  });

  it("reads as offline, not as an error, when the connection is down", async () => {
    const { sync, said } = engine(
      boom("fatal: unable to access 'https://github.com': Could not resolve host"),
    );
    await sync.pushNow();

    expect(sync.status().state).toBe("offline");
    expect(said("auth-suspect")).toBe(false);
  });

  it("retries by itself, and keeps the commit meanwhile", async () => {
    let attempts = 0;
    const { sync, git } = engine(() =>
      ++attempts === 1 ? new Error("fatal: the remote end hung up") : null,
    );
    await sync.pushNow();

    expect(sync.status().state).toBe("error");
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS);
    await vi.waitFor(() => expect(git.push).toHaveBeenCalledTimes(2));
    expect(sync.status().state).not.toBe("error");
  });

  it("backs off instead of hammering a remote that keeps refusing", async () => {
    const { sync, git } = engine(boom("fatal: the remote end hung up unexpectedly"));
    await sync.pushNow();

    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS - 1);
    expect(git.push).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(git.push).toHaveBeenCalledTimes(2));

    // The second wait is longer than the first, so a remote that is down for an hour is
    // asked a handful of times rather than seven hundred.
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS);
    expect(git.push).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS);
    await vi.waitFor(() => expect(git.push).toHaveBeenCalledTimes(3));
  });

  it("never puts the token in the error the user sees", async () => {
    const { sync } = engine(
      boom("fatal: could not read from 'https://gho_secret_token@github.com/nunu/vault.git'"),
    );
    await sync.pushNow();

    expect(sync.status().lastError).not.toContain("gho_secret_token");
    expect(sync.status().lastError).toContain("•••");
  });

  it("rebases and pushes again when the remote has moved on", async () => {
    let attempts = 0;
    const { sync, git } = engine(() =>
      ++attempts === 1 ? new Error("! [rejected] main -> main (fetch first)") : null,
    );
    await sync.pushNow();

    expect(git.pullRebase).toHaveBeenCalledTimes(1);
    expect(git.push).toHaveBeenCalledTimes(2);
    expect(sync.status().state).toBe("synced");
  });

  it("clears the error and the backoff once a push finally lands", async () => {
    let attempts = 0;
    const { sync, git } = engine(() =>
      ++attempts <= 2 ? new Error("fatal: the remote end hung up") : null,
    );
    await sync.pushNow();
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS);
    await vi.advanceTimersByTimeAsync(PUSH_RETRY_MIN_MS * 2);
    await vi.waitFor(() => expect(git.push).toHaveBeenCalledTimes(3));

    expect(sync.status().state).toBe("synced");
    expect(sync.status().lastError).toBeNull();
  });
});

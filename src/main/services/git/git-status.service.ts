import { spawn } from "node:child_process";
import { GIT_INSTALL_POLL_MS, GIT_INSTALL_WAIT_MS } from "@shared/constants";
import type { GitStatus } from "@shared/types";
import { fire } from "../../lib/fire";
import { getSettings } from "../../store/settings.store";
import { detectGit } from "./detect-git";

type Listener = (status: GitStatus) => void;

/**
 * The one answer to "can Marasca run git right now?", shared by setup, launch, IPC and
 * every GitService. Detection is cheap but not free, so the last answer is kept and only
 * redone when something could have changed it: launch, a recheck, a new path, or the
 * installer running.
 */
let status: GitStatus | null = null;
let installingSince: number | null = null;
let poll: NodeJS.Timeout | null = null;
const listeners = new Set<Listener>();

export function onGitStatus(fn: Listener): () => void {
  listeners.add(fn);

  return () => listeners.delete(fn);
}

/** The git every command runs. Before detection has found one, plain `git`. */
export function gitBinary(): string {
  return status?.state === "ready" ? status.binary : "git";
}

export async function currentGitStatus(): Promise<GitStatus> {
  return status ?? refreshGitStatus();
}

export async function refreshGitStatus(): Promise<GitStatus> {
  const found = await detectGit({ customPath: getSettings().gitPath });
  if (found.state === "ready") stopWaiting();
  // While the installer runs, "missing" is expected and not news: keep saying "installing".
  const next: GitStatus =
    found.state !== "ready" && installingSince !== null
      ? { state: "installing", startedAt: installingSince }
      : found;
  if (JSON.stringify(next) !== JSON.stringify(status)) {
    status = next;
    for (const fn of listeners) fn(next);
  }

  return next;
}

/**
 * Open Apple's Command Line Tools installer and watch for git to appear. The installer is
 * Apple's own dialog; nothing here can tell whether it was accepted or dismissed, so the
 * wait simply ends when git turns up, or after an hour.
 */
export async function installGitTools(): Promise<GitStatus> {
  if (process.platform !== "darwin") throw new Error("Install git with your package manager.");
  const child = spawn("xcode-select", ["--install"], { stdio: "ignore", detached: true });
  // It exits non-zero when the tools are already there — the recheck below says so.
  child.on("error", (e) => console.warn("xcode-select --install failed to start", e));
  child.unref();
  installingSince ??= Date.now();
  if (!poll) {
    poll = setInterval(() => {
      if (installingSince !== null && Date.now() - installingSince > GIT_INSTALL_WAIT_MS) {
        stopWaiting();
      }
      fire(refreshGitStatus(), "checking for git");
    }, GIT_INSTALL_POLL_MS);
  }

  return refreshGitStatus();
}

function stopWaiting(): void {
  installingSince = null;
  if (poll) clearInterval(poll);
  poll = null;
}

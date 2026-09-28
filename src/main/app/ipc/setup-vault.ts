import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
  DEFAULT_BRANCH,
  DEFAULT_HOTKEY,
  DEFAULT_PUSH_DEBOUNCE_MS,
  GIT_NOT_READY,
} from "@shared/constants";
import type { GitHubRepo, VaultConfig } from "@shared/types";
import { refreshGitStatus } from "../../services/git/git-status.service";
import { GitService } from "../../services/git/git.service";
import { getSettings, updateSettings } from "../../store/settings.store";
import { loadToken } from "../../store/token.store";
import type { session as appSession } from "../session/session";

/**
 * Point the app at a vault folder, with or without a GitHub repo behind it.
 *
 * Connecting an existing local vault to a repo runs through here too, so anything that
 * belongs to the vault rather than to the repo is carried over — otherwise attaching a
 * remote silently reset the hotkey, the push cadence and the last project.
 */
export async function setupVault(
  session: typeof appSession,
  repo: GitHubRepo | null,
  localPath: string,
): Promise<VaultConfig> {
  // Checked afresh, not from the cache: this is the step that can't work without it, and
  // the renderer's gate may be a moment behind an installer that just finished.
  if ((await refreshGitStatus()).state !== "ready") throw new Error(GIT_NOT_READY);
  const config = configFor(repo, localPath);
  if (repo) await cloneInto(repo, localPath);
  if (!existsSync(join(localPath, ".git"))) await GitService.init(localPath, config.branch);
  updateSettings({ vault: config, onboarded: true });
  const vault = await session.openVault(config);
  if (repo) {
    await vault.git.setRemote(repo.cloneUrl);
    vault.schedulePush();
  }

  return config;
}

/** The config for this folder and repo, keeping what the vault already had at that path. */
function configFor(repo: GitHubRepo | null, localPath: string): VaultConfig {
  const previous = getSettings().vault;
  const keep = previous?.root === localPath ? previous : null;

  return {
    root: localPath,
    remote: repo?.fullName ?? null,
    branch: repo?.defaultBranch ?? keep?.branch ?? DEFAULT_BRANCH,
    lastProject: keep?.lastProject ?? null,
    lastSource: keep?.lastSource ?? "claude",
    hotkey: keep?.hotkey ?? DEFAULT_HOTKEY,
    pushDebounceMs: keep?.pushDebounceMs ?? DEFAULT_PUSH_DEBOUNCE_MS,
  };
}

/**
 * Get `repo` into `localPath`, or say why not. Every clone failure used to be read as
 * "the repo is empty": offline, a 401, a folder that already had files in it — each
 * ended in `git init` in whatever folder was picked, pointed at the repo, and pushed.
 */
async function cloneInto(repo: GitHubRepo, localPath: string): Promise<void> {
  const token = loadToken();
  if (existsSync(join(localPath, ".git"))) {
    // Already a repo. Fine if it is this one; pushing another project's history into
    // the chosen repo is not.
    const origin = await GitService.originOf(localPath);
    if (origin && repoName(origin) !== repoName(repo.cloneUrl)) {
      throw new Error(
        `“${basename(localPath)}” is already a git repo for ${repoName(origin) ?? origin}. Pick another folder.`,
      );
    }

    return;
  }
  if (hasFiles(localPath)) {
    throw new Error(
      `“${basename(localPath)}” already has files in it. Pick an empty folder for ${repo.fullName}.`,
    );
  }
  try {
    await GitService.clone(repo.cloneUrl, localPath, token, repo.defaultBranch);
  } catch (e) {
    // A repo with no commits can't be cloned onto a branch; that one case starts local
    // and points origin at it. Anything else is a real failure and is said as one.
    if (await GitService.remoteIsEmpty(repo.cloneUrl, token)) return;
    const reason = (e instanceof Error ? e.message : String(e)).split("\n")[0];
    throw new Error(`Couldn’t clone ${repo.fullName}: ${reason}`, { cause: e });
  }
}

/** Anything in the folder but the Finder's own litter. */
function hasFiles(dir: string): boolean {
  try {
    return readdirSync(dir).some((f) => f !== ".DS_Store");
  } catch {
    return false;
  }
}

/** `owner/name` from any GitHub remote URL, lower-cased; null when it isn't one. */
function repoName(url: string): string | null {
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(url.trim());

  return m ? m[1].toLowerCase() : null;
}

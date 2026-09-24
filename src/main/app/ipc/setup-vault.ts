import { existsSync } from "node:fs";
import { join } from "node:path";
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
  const previous = getSettings().vault;
  const keep = previous?.root === localPath ? previous : null;
  const config: VaultConfig = {
    root: localPath,
    remote: repo?.fullName ?? null,
    branch: repo?.defaultBranch ?? keep?.branch ?? DEFAULT_BRANCH,
    lastProject: keep?.lastProject ?? null,
    lastSource: keep?.lastSource ?? "claude",
    hotkey: keep?.hotkey ?? DEFAULT_HOTKEY,
    pushDebounceMs: keep?.pushDebounceMs ?? DEFAULT_PUSH_DEBOUNCE_MS,
  };
  if (repo && !existsSync(join(localPath, ".git"))) {
    try {
      await GitService.clone(repo.cloneUrl, localPath, loadToken(), repo.defaultBranch);
    } catch {
      // An empty repo can't be cloned; init locally and point origin at it below.
    }
  }
  if (!existsSync(join(localPath, ".git"))) await GitService.init(localPath, config.branch);
  updateSettings({ vault: config, onboarded: true });
  const vault = await session.openVault(config);
  if (repo) {
    await vault.git.setRemote(repo.cloneUrl);
    vault.schedulePush();
  }

  return config;
}

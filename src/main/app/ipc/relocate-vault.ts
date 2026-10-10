import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { GIT_NOT_READY, VAULT_DIR } from "@shared/constants";
import type { VaultConfig } from "@shared/types";
import { refreshGitStatus } from "../../services/git/git-status.service";
import { GitService } from "../../services/git/git.service";
import { repoName } from "../../services/git/repo-name";
import { getSettings, updateSettings } from "../../store/settings.store";
import type { session as appSession } from "../session/session";

const PICK_AGAIN = "Choose the folder your vault is in now.";

/**
 * Point the app at the folder its vault lives in now, after that folder was moved or
 * renamed outside Marasca. Short of this, the only ways were Reset or editing the config
 * file by hand, and a vault moved in Finder showed as an empty library.
 *
 * Nothing is moved, cloned or created: the folder has to be this vault already, so a
 * wrong pick is refused rather than turned into a vault. Only `root` changes — the
 * hotkey, the push cadence, the image folders and the last project go with the vault,
 * not with where it sits.
 */
export async function relocateVault(
  session: typeof appSession,
  localPath: string,
): Promise<VaultConfig> {
  const current = getSettings().vault;
  if (!current) throw new Error("No vault is set up");
  if (localPath === current.root && session.vault) return current;
  if ((await refreshGitStatus()).state !== "ready") throw new Error(GIT_NOT_READY);
  await assertSameVault(current, localPath);
  const next = { ...current, root: localPath };
  try {
    await session.openVault(next);
  } catch (e) {
    // Opening the new folder closed the vault that was open. A folder that passed the
    // checks and still wouldn't open must not cost the one that worked.
    if (existsSync(current.root)) await session.openVault(current).catch(() => undefined);
    throw e;
  }
  // Written only once it has opened, so a refused or unreadable folder is never the one
  // the next launch goes looking for.
  updateSettings({ vault: next });

  return next;
}

/**
 * Refuse a folder that isn't this vault, saying what it is instead. A vault on GitHub is
 * known by its repo; a local-only one has no such name, so it is known by the `.vault`
 * folder Marasca keeps in every vault it has opened.
 */
async function assertSameVault(vault: VaultConfig, dir: string): Promise<void> {
  const name = basename(dir);
  if (!existsSync(join(dir, ".git"))) {
    throw new Error(`“${name}” isn’t your vault: it has no git history. ${PICK_AGAIN}`);
  }
  if (!vault.remote) {
    if (existsSync(join(dir, VAULT_DIR))) return;
    throw new Error(`“${name}” is a git repo, but not one Marasca has used. ${PICK_AGAIN}`);
  }
  const origin = await GitService.originOf(dir);
  if (!origin) throw new Error(`“${name}” isn’t connected to ${vault.remote}. ${PICK_AGAIN}`);
  const repo = repoName(origin);
  if (repo !== vault.remote.toLowerCase()) {
    throw new Error(
      `“${name}” is a git repo for ${repo ?? origin}, not ${vault.remote}. ${PICK_AGAIN}`,
    );
  }
}

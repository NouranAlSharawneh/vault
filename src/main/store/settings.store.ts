import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HOTKEY, LEGACY_HOTKEYS } from "@shared/constants";
import type { AppSettings } from "./settings.types";
import { userDataDir } from "./user-data-dir";

/**
 * Tiny JSON settings store in userData. Holds app config only — nothing that
 * belongs in the vault repo, and never the GitHub token.
 */
const DEFAULTS: AppSettings = {
  vault: null,
  authMethod: null,
  githubClientId: null,
  onboarded: false,
  gitPath: null,
};

let cache: AppSettings | null = null;

function configPath(): string {
  return join(userDataDir(), "config.json");
}

export function getSettings(): AppSettings {
  if (cache) return cache;
  try {
    cache = migrate({ ...DEFAULTS, ...JSON.parse(readFileSync(configPath(), "utf8")) });
  } catch {
    // Unreadable is not the same as absent. Keep a copy before the defaults take over:
    // the next write replaced the only record of which vault this was.
    const path = configPath();
    if (existsSync(path)) {
      try {
        copyFileSync(path, `${path}.bak`);
      } catch {
        /* nothing more to keep */
      }
    }
    cache = { ...DEFAULTS };
  }

  return cache!;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  // Written beside and renamed over, so a quit mid-write never leaves half a file; and
  // only remembered once it is on disk, so memory and disk can't disagree.
  const path = configPath();
  writeFileSync(`${path}.tmp`, JSON.stringify(next, null, 2));
  renameSync(`${path}.tmp`, path);
  cache = next;

  return cache;
}

/** Bring an older config file up to date. A hotkey we used to ship follows the current default. */
function migrate(settings: AppSettings): AppSettings {
  const vault = settings.vault;
  if (vault && (LEGACY_HOTKEYS as readonly string[]).includes(vault.hotkey)) {
    return { ...settings, vault: { ...vault, hotkey: DEFAULT_HOTKEY } };
  }

  return settings;
}

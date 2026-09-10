import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HOTKEY, LEGACY_HOTKEYS } from "@shared/constants";
import { userDataDir } from "./user-data-dir";
import type { AppSettings } from "./settings.types";

/**
 * Tiny JSON settings store in userData. Holds app config only — nothing that
 * belongs in the vault repo, and never the GitHub token.
 */
const DEFAULTS: AppSettings = {
  vault: null,
  authMethod: null,
  githubClientId: null,
  onboarded: false,
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
    cache = { ...DEFAULTS };
  }
  return cache!;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  cache = { ...getSettings(), ...patch };
  writeFileSync(configPath(), JSON.stringify(cache, null, 2));
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

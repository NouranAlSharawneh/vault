import { isAbsolute } from "node:path";
import { PUSH_DEBOUNCE_OPTIONS } from "@shared/constants";
import type { VaultConfig } from "@shared/types";

/** The settings a window may change. The vault's root, remote and branch are not among them. */
export type ConfigPatch = Partial<Pick<VaultConfig, "hotkey" | "pushDebounceMs" | "assetDirs">>;

const ACCELERATOR = /^[\w+=\-[\];',./\\`]{1,64}$/;

/**
 * A settings change from a window, checked before it is merged and saved. It used to be
 * spread straight onto the config, so any key — `root` included — was written to disk and
 * copied onto the running vault, whose folder then disagreed with its own config.
 */
export function sanitizeConfigPatch(patch: unknown): ConfigPatch {
  if (!patch || typeof patch !== "object") throw new Error("Not a settings change");
  const out: ConfigPatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "hotkey") {
      if (typeof value !== "string" || !ACCELERATOR.test(value) || !value.includes("+"))
        throw new Error("That isn’t a shortcut Marasca can use");
      out.hotkey = value;
    } else if (key === "pushDebounceMs") {
      if (!(PUSH_DEBOUNCE_OPTIONS as readonly unknown[]).includes(value))
        throw new Error("That push delay isn’t one of the options");
      out.pushDebounceMs = value as number;
    } else if (key === "assetDirs") {
      out.assetDirs = assetDirs(value);
    } else {
      throw new Error(`“${key}” can’t be changed from here`);
    }
  }

  return out;
}

function assetDirs(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Image folders must be a list of folders");
  const dirs: Record<string, string> = {};
  for (const [slug, dir] of Object.entries(value)) {
    if (typeof dir !== "string" || !isAbsolute(dir))
      throw new Error("An image folder must be a full path");
    dirs[slug] = dir;
  }

  return dirs;
}

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";

const ICLOUD_DRIVE = join("Library", "Mobile Documents");

const inside = (child: string, parent: string) => {
  const rel = relative(parent, child);

  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel));
};

/**
 * Why a folder is a risky home for a vault, or null. iCloud Drive and git both moving
 * the same files leaves "file 2.md" copies, evicted files git sees as deleted, and a
 * `.git` folder iCloud half-syncs. That is iCloud Drive itself, and Desktop and
 * Documents when "Desktop & Documents Folders" is on — which is where the default
 * `~/Documents/vault` lands.
 *
 * `exists` is how the check looks at the disk, for tests: iCloud's Desktop & Documents
 * syncing shows as those two folders inside iCloud Drive.
 */
export function icloudWarning(
  folder: string,
  home = homedir(),
  exists: (path: string) => boolean = existsSync,
): string | null {
  const drive = join(home, ICLOUD_DRIVE);
  if (inside(folder, drive))
    return "This folder is in iCloud Drive. iCloud and git both managing the same files can leave duplicate copies and missing files — a folder outside iCloud is safer.";
  const docsSynced = exists(join(drive, "com~apple~CloudDocs", "Documents"));
  const synced = ["Documents", "Desktop"].find(
    (name) => inside(folder, join(home, name)) && docsSynced,
  );

  return synced
    ? `iCloud syncs your ${synced} folder. iCloud and git both managing the same files can leave duplicate copies and missing files — a folder outside ${synced} (in your home folder, say) is safer.`
    : null;
}

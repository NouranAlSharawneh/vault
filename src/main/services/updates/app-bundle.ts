import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";

/** Where Marasca is running from, as far as an update needs to know. */
export interface RunningApp {
  platform: NodeJS.Platform;
  packaged: boolean;
  /** `app.getPath("exe")`: …/Marasca.app/Contents/MacOS/Marasca on macOS. */
  exe: string;
}

/** The `.app` folder the executable sits in, or null when it isn't in one. */
export function bundleOf(exe: string): string | null {
  const macos = dirname(exe);
  const bundle = dirname(dirname(macos));

  return basename(macos) === "MacOS" && bundle.endsWith(".app") ? bundle : null;
}

/**
 * Why this copy can't put a new version in its own place, or null when it can. Each answer
 * is said under "Version X is out", next to the button that opens the download page instead.
 */
export async function inPlaceBlocker({
  platform,
  packaged,
  exe,
}: RunningApp): Promise<string | null> {
  if (platform !== "darwin") return "Updates install themselves on macOS only.";
  if (!packaged) return "A development build doesn’t update itself.";
  const bundle = bundleOf(exe);
  if (!bundle) return "Marasca isn’t running from an app bundle.";
  // Gatekeeper runs a quarantined app from a read-only copy somewhere random; replacing
  // that copy would change nothing the next launch sees.
  if (bundle.includes("/AppTranslocation/"))
    return "macOS is running a temporary copy of Marasca. Move it to Applications, then update from there.";
  try {
    // Both: the folder to swap the app in, and the app itself, which a rename moves.
    await access(dirname(bundle), constants.W_OK);
    await access(bundle, constants.W_OK);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EROFS")
      return "Marasca is running from the disk image. Drag it to Applications, then update from there.";

    return `Marasca can’t replace itself in ${homeRelative(dirname(bundle))} without an administrator.`;
  }

  return null;
}

function homeRelative(path: string): string {
  const home = homedir();

  return path === home || path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}

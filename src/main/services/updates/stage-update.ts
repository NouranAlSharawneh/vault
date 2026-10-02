import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { APP_ID } from "@shared/constants";
import { runFile } from "../../lib/run-file";

/**
 * Beside the running app, so the swap after quitting is two renames on one disk rather
 * than a copy that could be cut off half-way.
 */
export const STAGING_DIR = ".Marasca-update";
/** The new version inside the staging folder. */
export const STAGED_APP = "Marasca.app";

const MINUTE = 60_000;

/**
 * Delete a folder that holds an app. Not with `fs.rm`: inside Electron, `fs` reads every
 * `app.asar` as a folder, so a recursive remove stops at the first one, half done.
 */
export async function removeTree(path: string): Promise<void> {
  await runFile("/bin/rm", ["-rf", path], MINUTE);
}

/** The staging folder for the app at `bundle`. */
export function stagingFor(bundle: string): string {
  return join(dirname(bundle), STAGING_DIR);
}

/**
 * Copy Marasca.app out of `dmg` into the staging folder beside `bundle`, check it is the
 * version asked for, and resolve with the staging folder. Anything wrong removes the
 * folder again: nothing half-made is left for the swap to find.
 */
export async function stageUpdate(
  dmg: string,
  bundle: string,
  version: string,
  work: string,
): Promise<string> {
  const staging = stagingFor(bundle);
  const app = join(staging, STAGED_APP);
  const mnt = join(work, "mnt");
  await removeTree(staging);
  await mkdir(staging);
  try {
    await runFile(
      "/usr/bin/hdiutil",
      ["attach", "-nobrowse", "-readonly", "-noautoopen", "-mountpoint", mnt, dmg],
      2 * MINUTE,
    );
    try {
      await runFile("/usr/bin/ditto", [join(mnt, STAGED_APP), app], 5 * MINUTE);
    } finally {
      await runFile("/usr/bin/hdiutil", ["detach", "-quiet", mnt], MINUTE).catch(() =>
        runFile("/usr/bin/hdiutil", ["detach", "-force", "-quiet", mnt], MINUTE).catch(
          () => undefined,
        ),
      );
    }
    await checkStagedApp(app, version);
    // Fetched by Marasca itself it carries no quarantine flag, but a flag would put the
    // "could not verify" prompt in front of the relaunch, so make sure.
    await runFile("/usr/bin/xattr", ["-dr", "com.apple.quarantine", app], MINUTE).catch(
      () => undefined,
    );
  } catch (e) {
    await removeTree(staging).catch(() => undefined);
    throw e;
  }

  return staging;
}

/** The app is Marasca, the version asked for, and its signature matches its files. */
async function checkStagedApp(app: string, version: string): Promise<void> {
  const plist = join(app, "Contents", "Info.plist");
  const read = async (key: string) =>
    (await runFile("/usr/bin/plutil", ["-extract", key, "raw", "-o", "-", plist], MINUTE)).trim();
  if ((await read("CFBundleIdentifier")) !== APP_ID)
    throw new Error("The download isn’t Marasca. Nothing was installed.");
  const found = await read("CFBundleShortVersionString");
  if (found !== version)
    throw new Error(`The download is version ${found}, not ${version}. Nothing was installed.`);
  try {
    await runFile("/usr/bin/codesign", ["--verify", "--deep", "--strict", app], 2 * MINUTE);
  } catch {
    throw new Error("The new version’s signature doesn’t match its files. Nothing was installed.");
  }
}

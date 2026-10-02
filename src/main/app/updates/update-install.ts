import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import { compareVersions } from "@shared/helpers";
import type { UpdateInstall } from "@shared/types";
import { APP_REPO } from "../../data/menu.data";
import { bundleOf, inPlaceBlocker } from "../../services/updates/app-bundle";
import { DOWNLOAD_DIR_PREFIX, prepareUpdate } from "../../services/updates/prepare-update";
import { removeTree, STAGED_APP, stagingFor } from "../../services/updates/stage-update";
import { spawnUpdateHelper } from "../../services/updates/update-helper";
import { broadcast } from "../../windows/broadcast";
import { closeDocumentWindows } from "../../windows/close-document-windows";
import { getMainWindow } from "../../windows/main.window";

/** An install under way or failed; null when nothing has been tried. */
let current: UpdateInstall | null = null;
let running: Promise<void> | null = null;
/** A version already downloaded and checked, kept when the quit was held up. */
let staged: { version: string; staging: string } | null = null;

const runningApp = () => ({
  platform: process.platform,
  packaged: app.isPackaged,
  exe: app.getPath("exe"),
});

/**
 * Where an install has got to; with none under way, whether this copy can replace itself
 * (asked each time: the folder may have changed hands since launch).
 */
export async function updateInstallState(): Promise<UpdateInstall> {
  if (current) return current;
  const reason = await inPlaceBlocker(runningApp());

  return reason ? { phase: "manual", reason } : { phase: "ready" };
}

/**
 * Download `version`, stage it beside this app, then quit so the swap can run and reopen
 * Marasca on it. Editor windows ask about unsaved text first; one kept open stops the
 * update, and the download is kept for the next try. A second call while one is running
 * joins it.
 */
export function installUpdate(version: string): Promise<void> {
  running ??= install(version).finally(() => (running = null));

  return running;
}

async function install(version: string): Promise<void> {
  try {
    // Asked for by name from a window, so only ever a newer version, never a downgrade.
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version))
      throw new Error(`“${version}” isn’t a version Marasca can install.`);
    if (compareVersions(version, app.getVersion()) <= 0)
      throw new Error(`Marasca ${app.getVersion()} is already ${version} or newer.`);
    const blocker = await inPlaceBlocker(runningApp());
    if (blocker) throw new Error(blocker);
    const bundle = bundleOf(app.getPath("exe"))!;
    if (staged?.version !== version || !existsSync(join(staged.staging, STAGED_APP))) {
      staged = null;
      const staging = await prepareUpdate({
        repo: APP_REPO,
        version,
        arch: process.arch,
        bundle,
        report: throttled(set),
      });
      staged = { version, staging };
    }
    if (!(await closeDocumentWindows()))
      throw new Error("Save or close the open document, then update again.");
    set({ phase: "restarting", version });
    await spawnUpdateHelper({
      pid: process.pid,
      target: bundle,
      staging: staged.staging,
      log: join(app.getPath("logs"), "update.log"),
    });
    // The usual quit: `will-quit` still pushes what is waiting before the process ends,
    // and the swap waits for exactly that.
    app.quit();
  } catch (e) {
    set({ phase: "failed", version, message: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}

function set(next: UpdateInstall): void {
  current = next;
  broadcast("app:updateInstall", next);
  // The Dock icon shows the download too, for an update started from the menu.
  const win = getMainWindow();
  if (next.phase === "downloading" && next.total)
    win?.setProgressBar(Math.min(next.received / next.total, 1));
  else if (next.phase === "installing" || next.phase === "restarting") win?.setProgressBar(2);
  else win?.setProgressBar(-1);
}

/** Progress at most once a percent (or a megabyte, size unknown); every other state as is. */
function throttled(report: (s: UpdateInstall) => void): (s: UpdateInstall) => void {
  let last = -1;

  return (s) => {
    if (s.phase === "downloading" && s.received > 0) {
      const step = s.total ? Math.floor((s.received / s.total) * 100) : s.received >> 20;
      if (step === last) return;
      last = step;
    }
    report(s);
  };
}

/**
 * At launch: anything an interrupted update left behind, the staging folder beside the app
 * and downloads in the temporary folder. A finished update leaves neither.
 */
export async function sweepUpdateLeftovers(): Promise<void> {
  const bundle = app.isPackaged ? bundleOf(app.getPath("exe")) : null;
  if (bundle) await removeTree(stagingFor(bundle));
  const tmp = tmpdir();
  for (const name of await readdir(tmp).catch(() => [] as string[]))
    if (name.startsWith(DOWNLOAD_DIR_PREFIX))
      await rm(join(tmp, name), { recursive: true, force: true }).catch(() => undefined);
}

/** For tests: forget any install. */
export function resetUpdateInstall(): void {
  current = null;
  running = null;
  staged = null;
}

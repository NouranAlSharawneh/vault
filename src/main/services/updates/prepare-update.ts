import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UpdateInstall } from "@shared/types";
import { getRelease } from "../../network/github";
import { downloadToFile, fetchText } from "./download-update";
import { expectedHash, pickUpdateAssets } from "./release-assets";
import { stageUpdate } from "./stage-update";

/** Temporary folders for downloads start with this; launch sweeps any left behind. */
export const DOWNLOAD_DIR_PREFIX = "marasca-update-";

export interface PrepareUpdate {
  repo: string;
  version: string;
  arch: string;
  /** The running app, which the new version is staged beside. */
  bundle: string;
  /** Downloading (with progress), then installing. */
  report: (state: UpdateInstall) => void;
}

/**
 * Everything an update needs before Marasca quits: find `version`'s DMG, download it,
 * check it against the release's SHA256SUMS.txt, and copy the new app out of it beside the
 * running one. Resolves with the staging folder. The download itself is deleted either way.
 */
export async function prepareUpdate({ repo, version, arch, bundle, report }: PrepareUpdate) {
  report({ phase: "downloading", version, received: 0, total: null });
  const { dmg, sums } = pickUpdateAssets(
    await getRelease(repo, `v${version}`),
    repo,
    version,
    arch,
  );
  const expected = expectedHash(await fetchText(sums.browser_download_url), dmg.name);
  if (!expected) throw new Error(`The checksums don’t list ${dmg.name}. Nothing was installed.`);

  const work = await mkdtemp(join(tmpdir(), DOWNLOAD_DIR_PREFIX));
  try {
    const file = join(work, dmg.name);
    const actual = await downloadToFile(
      dmg.browser_download_url,
      file,
      ({ received, total }) => report({ phase: "downloading", version, received, total }),
      dmg.size || null,
    );
    if (actual !== expected)
      throw new Error("The download doesn’t match its checksum. Nothing was installed.");
    report({ phase: "installing", version });

    return await stageUpdate(file, bundle, version, work);
  } finally {
    // Still mounted if the detach failed: the read-only image can't be emptied, and
    // that is no reason to fail an update that is otherwise ready.
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

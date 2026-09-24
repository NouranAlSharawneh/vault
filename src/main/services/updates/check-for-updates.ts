import { compareVersions } from "@shared/helpers";
import type { UpdateCheck } from "@shared/types";
import { NetworkError } from "../../network/axios";
import { listReleases } from "../../network/github";

/**
 * Compares `current` with the newest published release of `repo`. There is no
 * auto-update: the app is not notarized, so Squirrel can't install one. This only tells
 * you a new version exists and where to download it.
 *
 * A 404 means there is nothing to compare against (no releases yet, or the repo is
 * private), which is not an error for the user. Anything else (offline, rate limited)
 * throws, so Settings can say it couldn't check.
 */
export async function checkForUpdates(repo: string, current: string): Promise<UpdateCheck> {
  let releases;
  try {
    releases = await listReleases(repo);
  } catch (e) {
    if (e instanceof NetworkError && e.status === 404) return { status: "none", current };
    throw e;
  }
  const newest = releases
    .map((r) => ({ version: r.tag_name.replace(/^v/, ""), url: r.html_url }))
    .sort((a, b) => compareVersions(b.version, a.version))[0];
  if (!newest) return { status: "none", current };

  return compareVersions(newest.version, current) > 0
    ? { status: "available", current, latest: newest.version, url: newest.url }
    : { status: "up-to-date", current, latest: newest.version };
}

import { githubApi } from "../axios";
import type { RawRelease } from "./github.types";

/**
 * Published releases of `fullName`, newest first. Uses the list rather than
 * `/releases/latest`, which skips prereleases, and every 0.x build is one.
 */
export async function listReleases(fullName: string): Promise<RawRelease[]> {
  const { data } = await githubApi().get<RawRelease[]>(`/repos/${fullName}/releases`, {
    params: { per_page: 20 },
  });

  return data.filter((r) => !r.draft);
}

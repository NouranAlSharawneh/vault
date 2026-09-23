import { REPO_MAX_PAGES, REPO_PAGE_SIZE } from "@shared/constants";
import type { GitHubRepo } from "@shared/types";
import { githubApi } from "../axios";
import type { RawGitHubRepo } from "./github.types";
import { mapRepo } from "./map-repo";

/** Repos the token can push to, most recently pushed first (up to 500). */
export async function listRepos(): Promise<GitHubRepo[]> {
  const out: GitHubRepo[] = [];
  for (let page = 1; page <= REPO_MAX_PAGES; page++) {
    const { data } = await githubApi().get<RawGitHubRepo[]>("/user/repos", {
      params: { per_page: REPO_PAGE_SIZE, sort: "pushed", affiliation: "owner,collaborator", page },
    });
    out.push(...data.filter((r) => r.permissions?.push !== false).map(mapRepo));
    if (data.length < REPO_PAGE_SIZE) break;
  }

  return out;
}

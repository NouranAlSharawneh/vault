import { CREATE_REPO_FORBIDDEN } from "@shared/constants";
import type { GitHubRepo } from "@shared/types";
import { githubApi, NetworkError } from "../axios";
import type { RawGitHubRepo } from "./github.types";
import { mapRepo } from "./map-repo";

export async function createRepo(name: string, isPrivate: boolean): Promise<GitHubRepo> {
  try {
    const { data } = await githubApi().post<RawGitHubRepo>("/user/repos", {
      name,
      private: isPrivate,
      auto_init: false,
      description: "Markdown vault — captured with Vault",
    });

    return mapRepo(data);
  } catch (e) {
    // A fine-grained token scoped to one repo gets 403 here ("Resource not accessible by
    // personal access token"). Rate limiting is a 403 too, and that one should say so.
    if (e instanceof NetworkError && e.status === 403 && !/rate limit/i.test(e.message))
      throw new NetworkError(CREATE_REPO_FORBIDDEN, 403, e.code);
    throw e;
  }
}

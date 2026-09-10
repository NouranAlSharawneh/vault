import type { GitHubRepo } from "@shared/types";
import { githubApi } from "../axios";
import type { RawGitHubRepo } from "./github.types";
import { mapRepo } from "./map-repo";

export async function createRepo(name: string, isPrivate: boolean): Promise<GitHubRepo> {
  const { data } = await githubApi().post<RawGitHubRepo>("/user/repos", {
    name,
    private: isPrivate,
    auto_init: false,
    description: "Markdown vault — captured with Vault",
  });
  return mapRepo(data);
}

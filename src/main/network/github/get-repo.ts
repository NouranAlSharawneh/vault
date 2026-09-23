import type { GitHubRepo } from "@shared/types";
import { githubApi } from "../axios";
import type { RawGitHubRepo } from "./github.types";
import { mapRepo } from "./map-repo";

export async function getRepo(fullName: string): Promise<GitHubRepo> {
  const { data } = await githubApi().get<RawGitHubRepo>(`/repos/${fullName}`);

  return mapRepo(data);
}

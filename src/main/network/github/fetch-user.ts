import type { GitHubUser } from "@shared/types";
import { githubApi } from "../axios";
import type { RawGitHubUser } from "./github.types";

/** Validates the current token and returns who it belongs to. */
export async function fetchUser(): Promise<GitHubUser> {
  const { data } = await githubApi().get<RawGitHubUser>("/user");

  return { login: data.login, name: data.name, avatarUrl: data.avatar_url };
}

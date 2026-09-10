import type { GitHubRepo } from "@shared/types";
import type { RawGitHubRepo } from "./github.types";

export function mapRepo(r: RawGitHubRepo): GitHubRepo {
  return {
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    private: r.private,
    defaultBranch: r.default_branch,
    cloneUrl: r.clone_url,
    pushedAt: r.pushed_at,
    description: r.description,
  };
}

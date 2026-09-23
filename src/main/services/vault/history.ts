import type { CommitInfo } from "@shared/types";
import type { GitService } from "../git/git.service";

/**
 * Where this document lived at that commit. Moving a doc between projects is a `git mv`,
 * so asking for today's path at an older commit finds nothing.
 */
async function pathAt(git: GitService, relPath: string, sha: string): Promise<string> {
  const found = (await git.log(relPath)).find((c) => c.sha === sha);

  return found?.path ?? relPath;
}

export async function history(git: GitService, relPath: string): Promise<CommitInfo[]> {
  return git.log(relPath);
}

/** The document's full text as of that commit. */
export async function atCommit(git: GitService, relPath: string, sha: string): Promise<string> {
  return git.show(await pathAt(git, relPath, sha), sha);
}

/** What this commit changed, as a unified diff. */
export async function diff(git: GitService, relPath: string, sha: string): Promise<string> {
  return git.diff(await pathAt(git, relPath, sha), sha);
}

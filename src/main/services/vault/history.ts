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

/**
 * What this commit changed, as a unified diff. A commit that moved the document (a new
 * project, a new title) is asked about under both its names, with rename detection, so it
 * shows as the edit it was — asked about the new name alone, git reported the whole file
 * as added.
 */
export async function diff(git: GitService, relPath: string, sha: string): Promise<string> {
  const commits = await git.log(relPath);
  const i = commits.findIndex((c) => c.sha === sha);
  const at = commits[i]?.path ?? relPath;
  const before = i >= 0 ? commits[i + 1]?.path : undefined;

  return git.diff(before && before !== at ? [at, before] : [at], sha);
}

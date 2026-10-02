import { HISTORY_PAGE } from "@shared/constants";
import type { CommitInfo } from "@shared/types";
import type { GitService } from "../git/git.service";

/**
 * How far back a name is looked up. History pages past the first fifty, and reading or
 * diffing a commit on page three has to find the name the file had then.
 */
const NAME_LOOKBACK = 1000;

/**
 * Where this document lived at that commit. Moving a doc between projects is a `git mv`,
 * so asking for today's path at an older commit finds nothing.
 */
async function pathAt(git: GitService, relPath: string, sha: string): Promise<string> {
  const found = (await git.log(relPath, NAME_LOOKBACK)).find((c) => c.sha === sha);

  return found?.path ?? relPath;
}

/** One page of commits, newest first, each with what it did to the document. */
export async function history(git: GitService, relPath: string, skip = 0): Promise<CommitInfo[]> {
  return git.logStats(relPath, HISTORY_PAGE, skip);
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
  const commits = await git.log(relPath, NAME_LOOKBACK);
  const i = commits.findIndex((c) => c.sha === sha);
  const at = commits[i]?.path ?? relPath;
  const before = i >= 0 ? commits[i + 1]?.path : undefined;

  return git.diff(before && before !== at ? [at, before] : [at], sha);
}

/**
 * Everything that changed since that commit, up to the file as it is now — the question
 * "what have I done to it since?", which a single commit's diff can't answer.
 */
export async function compare(git: GitService, relPath: string, sha: string): Promise<string> {
  const then = await pathAt(git, relPath, sha);

  return git.compare(then === relPath ? [relPath] : [then, relPath], sha);
}

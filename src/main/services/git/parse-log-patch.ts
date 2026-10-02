import { relativeTime } from "@shared/helpers";
import type { CommitInfo } from "@shared/types";

/** Starts every commit's header line in the log format below. */
export const LOG_SEP = "\u001f";

/**
 * A line of the metadata block, or the fence and rule around it. A commit that changed
 * nothing else — a star, a tag, a move to another project — is folded away in History:
 * a starred-and-unstarred document had more rows about its star than about its text.
 */
const META_LINE = /^(?:(?:title|project|tags|created|source|starred|conflict):|---$|```(?:yaml)?$)/;

function isMetaLine(line: string): boolean {
  const text = line.trim();

  return !text || META_LINE.test(text);
}

function commitFrom(line: string, path: string): CommitInfo {
  const [, sha, date, author, message] = line.split(LOG_SEP);

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    date,
    relative: relativeTime(date),
    author,
    path,
    added: 0,
    removed: 0,
    metaOnly: true,
  };
}

/** One changed line inside a hunk: counted, and checked for being more than metadata. */
function count(commit: CommitInfo, line: string): void {
  const sign = line[0];
  if (sign !== "+" && sign !== "-") return;
  if (sign === "+") commit.added = (commit.added ?? 0) + 1;
  else commit.removed = (commit.removed ?? 0) + 1;
  if (!isMetaLine(line.slice(1))) commit.metaOnly = false;
}

/**
 * `git log -p --follow --unified=0` for one file, as commits with their stats: lines
 * added and removed, whether only the metadata moved, and the file's name in each commit
 * (a project change is a rename, and an old version has to be read under its old name).
 *
 * Header lines (`--- a/…`, `+++ b/…`) and content lines look alike when the text itself
 * starts with `--` or `++`, so which is which goes by position: content only after `@@`.
 */
export function parseLogPatch(out: string, path: string): CommitInfo[] {
  const commits: CommitInfo[] = [];
  let current: CommitInfo | null = null;
  let inHunk = false;

  for (const line of out.split("\n")) {
    if (line.startsWith(LOG_SEP)) {
      current = commitFrom(line, path);
      commits.push(current);
      inHunk = false;
    } else if (!current) {
      continue;
    } else if (line.startsWith("diff --git ")) {
      inHunk = false;
    } else if (line.startsWith("@@")) {
      inHunk = true;
    } else if (inHunk) {
      count(current, line);
    } else if (line.startsWith("+++ b/")) {
      current.path = line.slice(6);
    } else if (line.startsWith("rename to ")) {
      current.path = line.slice(10);
    }
  }

  return commits;
}

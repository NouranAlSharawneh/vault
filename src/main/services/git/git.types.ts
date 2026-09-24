import type { GitSource } from "@shared/types";

export type TokenProvider = () => string | null;

export interface ChangedFile {
  status: string;
  path: string;
  oldPath?: string;
}

export interface AheadBehind {
  ahead: number;
  behind: number;
}

/**
 * Where one side of a conflict came from. Named for its origin rather than git's
 * "ours"/"theirs", which swap meaning between a merge and a rebase.
 */
export type ConflictSide = "mine" | "remote";

/** A place git is often installed that a Finder-launched app's PATH doesn't include. */
export interface GitCandidate {
  /** Absolute, or starting with `~/`. */
  path: string;
  source: GitSource;
}

/** `git version 2.39.5 (Apple Git-154)` → `2.39.5`. Null when the output isn't git's. */
export function parseGitVersion(output: string): string | null {
  return /git version (\d+\.\d+(?:\.\d+)?)/.exec(output)?.[1] ?? null;
}

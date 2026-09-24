import type { ConflictChoice } from "@shared/types";

/** What settling one conflicting pair did, in the words the review sheet itself uses. */
export function describeResolution(
  choice: ConflictChoice,
  title: string,
  theirsFile: string,
): string {
  const name = `“${title}”`;
  if (choice === "mine")
    return `Kept this Mac’s version of ${name} — the GitHub one is in the trash`;
  if (choice === "theirs") return `Kept the GitHub version of ${name} — this Mac’s is in the trash`;

  return `Kept both versions of ${name} — the GitHub one is saved as ${theirsFile}`;
}

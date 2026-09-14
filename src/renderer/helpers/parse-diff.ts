import type { DiffHunk, DiffLine } from "@shared/types";

/**
 * A unified diff into hunks of typed lines. Only what a reader needs: the file header
 * and index lines are noise here, since the drawer already says which document it is.
 */
export function parseUnifiedDiff(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  const lines = diff.split("\n");
  // A diff ends with a newline, and splitting leaves a phantom "" behind it. A genuinely
  // blank context line is a single space, so only the trailing element is an artifact.
  if (lines.at(-1) === "") lines.pop();

  for (const raw of lines) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(raw);
    if (header) {
      oldLine = Number(header[1]);
      newLine = Number(header[2]);
      current = { heading: header[3].trim(), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue; // preamble: diff --git, index, ---/+++
    if (raw.startsWith("+++") || raw.startsWith("---")) continue;
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"

    const kind: DiffLine["kind"] = raw.startsWith("+")
      ? "added"
      : raw.startsWith("-")
        ? "removed"
        : "context";
    const text = kind === "context" ? raw.slice(1) : raw.slice(1);
    current.lines.push({
      kind,
      text,
      oldLine: kind === "added" ? null : oldLine,
      newLine: kind === "removed" ? null : newLine,
    });
    if (kind !== "added") oldLine++;
    if (kind !== "removed") newLine++;
  }
  return hunks;
}

/** Added/removed counts across every hunk, for the summary line. */
export function diffStat(hunks: DiffHunk[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of hunks) {
    for (const l of h.lines) {
      if (l.kind === "added") added++;
      else if (l.kind === "removed") removed++;
    }
  }
  return { added, removed };
}

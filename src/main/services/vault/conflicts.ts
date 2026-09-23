import type { ConflictChoice, ConflictPair, Frontmatter } from "@shared/types";
import type { ConflictHost } from "./vault.types";

/**
 * Every stamped copy a pull left behind, paired with the document it came from, newest
 * first. Both sides are ordinary documents in the index; the `conflict` mark on the copy
 * is the only thing joining them.
 */
export function conflicts(host: ConflictHost): ConflictPair[] {
  const docs = host.index.snapshot().docs;
  const byPath = new Map(docs.map((d) => [d.path, d]));
  const pairs: ConflictPair[] = [];
  for (const theirs of docs) {
    const mark = theirs.conflict;
    const mine = mark && byPath.get(mark.of);
    if (mark && mine) pairs.push({ mine, theirs, mark });
  }

  return pairs.sort((a, b) => b.mark.at.localeCompare(a.mark.at));
}

/**
 * Settle one pair. `copyPath` is the stamped copy; the choice is about which text ends
 * up at the original path. Nothing is deleted — the loser goes to the trash, and both
 * versions stay in history either way.
 */
export async function resolveConflict(
  host: ConflictHost,
  copyPath: string,
  choice: ConflictChoice,
  pickFrontmatter: (m: Frontmatter) => Frontmatter,
): Promise<void> {
  const copy = await host.read(copyPath);
  const mark = copy.meta.conflict;
  if (!mark) throw new Error(`Not a conflict copy: ${copyPath}`);
  if (choice === "theirs") {
    // The version from GitHub wins: it takes the original's path, and the original goes
    // to the trash where it can still be brought back.
    const original = await host.read(mark.of).catch(() => null);
    if (original) await host.trash(mark.of);
    await host.save({
      body: copy.body,
      frontmatter: pickFrontmatter(original?.meta ?? copy.meta),
      existingPath: copyPath,
      commit: true,
    });
  } else if (choice === "mine") {
    await host.trash(copyPath);
  } else {
    // Keep both as separate documents. The stamp goes, and with it the only thing telling
    // the two apart — they share a title — so the title says it instead.
    await host.save({
      body: copy.body,
      frontmatter: { ...pickFrontmatter(copy.meta), title: `${copy.meta.title} (from GitHub)` },
      existingPath: copyPath,
      commit: true,
    });
  }
  await host.refreshSyncStatus();
}

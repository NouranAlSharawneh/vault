import { promises as fs } from "node:fs";
import { join } from "node:path";

/**
 * Every `.md` file under `dir`, depth-first, as absolute paths.
 *
 * The trash listing and the orphaned-asset scan each had their own copy of this loop,
 * differing only in which folders they stepped over and whether the caller wanted the
 * `.md` test case-sensitive. An unreadable folder is skipped rather than fatal: this
 * runs over folders the user can rearrange underneath it.
 */
export async function walkMarkdown(
  dir: string,
  skip: ReadonlySet<string> = new Set(),
): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.has(e.name)) out.push(...(await walkMarkdown(abs, skip)));
    } else if (e.name.toLowerCase().endsWith(".md")) {
      out.push(abs);
    }
  }

  return out;
}

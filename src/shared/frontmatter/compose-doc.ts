import { stringify as stringifyYaml } from "yaml";
import { META_FENCE_CLOSE, META_FENCE_OPEN, META_RULE } from "../constants";
import type { Frontmatter } from "../types";

/**
 * Serialise body + metadata back to a file: the content first, then a rule and a fenced
 * YAML block at the end. Key order is stable so diffs stay small.
 */
export function composeDoc(
  fm: Frontmatter,
  body: string,
  extra: Record<string, unknown> = {},
): string {
  const scalar = (v: unknown): string => stringifyYaml(v, { lineWidth: 0 }).trimEnd();
  const lines: string[] = [
    `title: ${scalar(fm.title)}`,
    `project: ${scalar(fm.project)}`,
    `tags: [${fm.tags.map((t) => scalar(t)).join(", ")}]`,
    `created: ${scalar(fm.created)}`,
    `source: ${fm.source}`,
  ];
  if (fm.starred) lines.push("starred: true");
  // Written out by hand as a flow mapping so the stamp stays one readable line in the
  // document, rather than three that churn the diff of a file you are already unsure about.
  if (fm.conflict) {
    const c = fm.conflict;
    lines.push(`conflict: { of: ${scalar(c.of)}, from: ${c.from}, at: ${scalar(c.at)} }`);
  }
  if (Object.keys(extra).length) lines.push(stringifyYaml(extra, { lineWidth: 0 }).trimEnd());
  const trimmed = body.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const block = `${META_RULE}\n\n${META_FENCE_OPEN}\n${lines.join("\n")}\n${META_FENCE_CLOSE}\n`;

  return trimmed ? `${trimmed}\n\n${block}` : block;
}

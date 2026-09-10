import { stringify as stringifyYaml } from "yaml";
import type { Frontmatter } from "../types";

/** Serialise frontmatter + body back to a file. Key order is stable so diffs stay small. */
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
  if (Object.keys(extra).length) lines.push(stringifyYaml(extra, { lineWidth: 0 }).trimEnd());
  const trimmed = body.replace(/^\s*\n/, "").replace(/\s+$/, "");
  return `---\n${lines.join("\n")}\n---\n\n${trimmed}\n`;
}

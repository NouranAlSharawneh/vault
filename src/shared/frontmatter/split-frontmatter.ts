import { FM_CLOSE, FM_OPEN } from "../constants";
import type { SplitResult } from "./frontmatter.types";

/**
 * Split a markdown file into its frontmatter YAML and body.
 * Only looks at the head of the file — cheap enough to run on 5k files.
 */
export function splitFrontmatter(raw: string): SplitResult {
  const open = FM_OPEN.exec(raw);
  if (!open) return { yaml: null, body: raw };
  const rest = raw.slice(open[0].length);
  const close = FM_CLOSE.exec(rest);
  if (!close) return { yaml: null, body: raw };
  return { yaml: rest.slice(0, close.index), body: rest.slice(close.index + close[0].length) };
}

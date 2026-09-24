import { FM_CLOSE, FM_OPEN, META_FENCE_OPEN, META_TAIL_CLOSE, META_TAIL_OPEN } from "../constants";
import type { SplitResult } from "./frontmatter.types";

/** The trailing block Marasca writes: `---`, blank line, ```yaml … ``` at end of file. */
function splitTail(raw: string): SplitResult | null {
  const close = META_TAIL_CLOSE.exec(raw);
  if (!close) return null;
  const fence = raw.lastIndexOf(META_FENCE_OPEN, close.index);
  if (fence < 0) return null;
  const openEnd = raw.indexOf("\n", fence);
  if (openEnd < 0 || openEnd > close.index) return null;
  const open = META_TAIL_OPEN.exec(raw.slice(0, openEnd + 1));
  if (!open) return null;
  const bodyEnd = openEnd + 1 - open[0].length;

  return {
    yaml: raw.slice(openEnd + 1, close.index),
    body: raw.slice(0, bodyEnd).replace(/^(?:[ \t]*\r?\n)+/, ""),
    position: "bottom",
  };
}

/** Classic frontmatter at the head of the file (Obsidian, Jekyll, older Marasca files). */
function splitHead(raw: string): SplitResult | null {
  const open = FM_OPEN.exec(raw);
  if (!open) return null;
  const rest = raw.slice(open[0].length);
  const close = FM_CLOSE.exec(rest);
  if (!close) return null;

  return {
    yaml: rest.slice(0, close.index),
    // Drop the blank line conventionally written between the closing `---` and the body,
    // so the editor doesn't open on an empty first line.
    body: rest.slice(close.index + close[0].length).replace(/^(?:[ \t]*\r?\n)+/, ""),
    position: "top",
  };
}

/**
 * Split a markdown file into its metadata YAML and body. Looks for Marasca's trailing
 * block first, then a classic head block; touches only the two ends of the file.
 */
export function splitFrontmatter(raw: string): SplitResult {
  return splitTail(raw) ?? splitHead(raw) ?? { yaml: null, body: raw, position: null };
}

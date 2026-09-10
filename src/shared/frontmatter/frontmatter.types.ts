import type { Frontmatter } from "../types";

export interface SplitResult {
  /** Raw YAML text between the fences, or null when there is no block. */
  yaml: string | null;
  body: string;
  /** Where the block was found; Vault always writes `bottom`. */
  position: "top" | "bottom" | null;
}

export interface ParsedDoc {
  frontmatter: Frontmatter | null;
  body: string;
  /** Fields present in the YAML that we don't own; preserved on write. */
  extra: Record<string, unknown>;
}

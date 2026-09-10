import type { Source } from "../types";

/**
 * Search grammar:
 *   project:"Atlas API"   tags:spec  tags:empty   created:>30d  created:<2026-01-01
 *   source:claude         is:starred  is:unpushed  is:orphan
 * Anything else is free text.
 */
export interface ParsedQuery {
  text: string;
  project: string[];
  tags: string[];
  tagsEmpty: boolean;
  source: Source[];
  starred?: boolean;
  unpushed?: boolean;
  orphan?: boolean;
  createdAfter?: number;
  createdBefore?: number;
}

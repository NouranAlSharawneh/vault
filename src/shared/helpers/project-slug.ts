import { INBOX_SLUG } from "../constants";
import { slugify } from "./slugify";

/** Folder name for a project; docs with no project go to `_inbox`. */
export function projectSlug(project: string | null | undefined): string {
  const p = (project ?? "").trim();

  return p ? slugify(p) : INBOX_SLUG;
}

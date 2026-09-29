import { INBOX_SLUG } from "@shared/constants";
import type { IndexSnapshot } from "@shared/types";

/**
 * Project names, the one written to most recently first — with the project captured into
 * last at the very front, since that is where the next capture most likely goes. The
 * capture sheet numbers these ⌘1–⌘9.
 */
export function recentProjects(index: IndexSnapshot | null, lastProject: string | null): string[] {
  if (!index) return [];
  const latest = new Map<string, number>();
  for (const d of index.docs) {
    const at = Math.max(d.mtime || 0, Date.parse(d.created) || 0);
    latest.set(d.projectSlug, Math.max(latest.get(d.projectSlug) ?? 0, at));
  }
  const projects = index.projects
    .filter((p) => p.slug !== INBOX_SLUG)
    .sort((a, b) => (latest.get(b.slug) ?? 0) - (latest.get(a.slug) ?? 0))
    .map((p) => p.name);
  const last = projects.findIndex((p) => p.toLowerCase() === lastProject?.toLowerCase());
  if (last > 0) projects.unshift(...projects.splice(last, 1));

  return projects;
}

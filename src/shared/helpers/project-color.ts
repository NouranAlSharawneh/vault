import { PROJECT_COLORS } from "../constants";

/** Deterministic colour for a project so nothing has to be stored. */
export function projectColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PROJECT_COLORS[h % PROJECT_COLORS.length];
}

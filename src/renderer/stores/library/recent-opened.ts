const KEY = "library-recent-opened";
/** Enough to fill the palette's Recent several times over, never a growing log. */
const KEEP = 20;

/** The documents last opened in the reader, most recent first. */
export function recentOpened(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;

    return Array.isArray(v) ? v.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Note that a document was opened. ⌘K's Recent used to be the newest *created* documents
 * — what you captured, not what you were reading — so the one you had just left was
 * rarely there to go back to.
 */
export function recordOpened(path: string): void {
  try {
    const next = [path, ...recentOpened().filter((p) => p !== path)].slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: Recent falls back to the newest documents */
  }
}

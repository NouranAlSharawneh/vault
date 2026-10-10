/** `owner/name` from any GitHub remote URL, lower-cased; null when it isn't one. */
export function repoName(url: string): string | null {
  const m = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(url.trim());

  return m ? m[1].toLowerCase() : null;
}

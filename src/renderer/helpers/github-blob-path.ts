/**
 * The GitHub page for a document, as the path `github:openInBrowser` takes: every segment
 * encoded, so a title with `#`, `?` or spaces opens that document instead of a 404.
 */
export function githubBlobPath(remote: string, branch: string, path: string): string {
  const file = path.split("/").map(encodeURIComponent).join("/");

  return `${remote}/blob/${encodeURIComponent(branch)}/${file}`;
}

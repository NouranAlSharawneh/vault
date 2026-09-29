/**
 * A system or git error in words: what went wrong and what to do. `EACCES: permission
 * denied, open '/var/folders/…'` told nobody anything. The original stays available —
 * callers put it in a tooltip.
 */
export function plainError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("index.lock"))
    return "Another git program is using the vault right now. Close it, or try again in a moment.";
  if (/enospc|no space left/.test(m)) return "The disk is full. Free some space and try again.";
  if (/eacces|eperm|permission denied|read-only file system/.test(m))
    return "Marasca isn’t allowed to write to the vault folder. Check its permissions in Finder.";
  if (/gpg|signing failed|failed to sign/.test(m))
    return "Git is set to sign commits and couldn’t. Check your git signing setup, or turn it off for this repo.";
  if (/enoent|no such file/.test(m))
    return "The file isn’t there any more — it was moved or deleted.";
  if (/unmerged files|merge conflict/.test(m))
    return "Git is in the middle of merging. Pull again from the sync badge, then save.";

  return message;
}

import { parentDir } from "./parent-dir";

export interface RenameHint {
  kind: "rename" | "move";
  /** The new file name for a rename; the new repo path for a move. */
  path: string;
}

/**
 * What the next save does to a saved document's file, from where it is (`from`) and
 * where the save would put it (`to`): rename it in its folder, move it to another, or
 * nothing — when it stays put, or has never been saved.
 */
export function renameHint(from: string | null, to: string): RenameHint | null {
  if (!from || !to || from === to) return null;

  return parentDir(from) === parentDir(to)
    ? { kind: "rename", path: to.slice(to.lastIndexOf("/") + 1) }
    : { kind: "move", path: to };
}

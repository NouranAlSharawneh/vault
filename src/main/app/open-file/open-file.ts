import { promises as fs } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { CAPTURE_FILE_MAX_BYTES, TRASH_DIR } from "@shared/constants";
import { openEditorWindow } from "../../windows";
import { showMainWindow } from "../session/launch-route";
import { session } from "../session/session";

/** What Finder, a drop or the command line may hand to Marasca. */
export function isMarkdownFile(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

/**
 * Where a file sits in the vault, as the vault's own relative path — or null when it is
 * outside it, or in the trash (which opens as a copy, like anything else outside).
 */
export function vaultPathOf(file: string, root: string): string | null {
  const rel = relative(root, file);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  const path = rel.split(sep).join("/");

  return path.startsWith(`${TRASH_DIR}/`) ? null : path;
}

/**
 * Open a markdown file from outside the app (Finder's "Open With", a drop on a window,
 * the command line) in an editor window.
 *
 * A file in the vault opens as itself. One anywhere else opens as a new, unsaved
 * document with its text: saving files it into the vault like any capture, with images
 * found beside the original, and the original is never written to — Marasca only ever
 * changes files it keeps in git, where every change can be undone.
 */
export async function openMarkdownFile(file: string): Promise<void> {
  if (!isMarkdownFile(file)) throw new Error("Marasca opens markdown files (.md)");
  const vault = session.vault;
  // No vault yet: the file has nowhere to go. Setup, or the vault that failed to open,
  // is what the window shows; the file can be opened again once there is one.
  if (!vault) return showMainWindow();
  const inVault = vaultPathOf(file, vault.root);
  if (inVault) {
    openEditorWindow({ path: inVault });

    return;
  }
  const { size } = await fs.stat(file);
  if (size > CAPTURE_FILE_MAX_BYTES)
    throw new Error("That file is too large to open as a note (over 2 MB).");
  const body = await fs.readFile(file, "utf8");
  openEditorWindow({ draft: { body, sourcePath: file } });
}

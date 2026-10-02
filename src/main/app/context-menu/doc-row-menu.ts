import { join } from "node:path";
import { type BrowserWindow, clipboard, Menu, shell } from "electron";
import type { DocRowAction, DocRowMenuInput } from "@shared/types";

/**
 * The right-click menu for a document row, or for a selection of them. What only makes
 * sense for one document (open, reveal, copy its path, its GitHub page) is left out when
 * several are selected; what applies to many says how many it will touch.
 */
export function buildDocRowMenu(
  input: DocRowMenuInput,
  choose: (action: DocRowAction) => void,
): Electron.MenuItemConstructorOptions[] {
  const many = input.count > 1;
  const them = `${input.count.toLocaleString()} documents`;
  const item = (label: string, action: DocRowAction, enabled = true) => ({
    label,
    enabled,
    click: () => choose(action),
  });
  const single: Electron.MenuItemConstructorOptions[] = many
    ? []
    : [
        item("Reveal in Finder", "reveal"),
        item("Copy Path", "copyPath"),
        // Not pushed yet, the page is a 404: offered, but not clickable.
        item("Open on GitHub", "github", input.github),
      ];
  // In the trash it has no GitHub page of its own, and no place to open or star it.
  if (input.trashed) return single.filter((i) => i.label !== "Open on GitHub");

  return [
    ...(many ? [] : [item("Open in Editor", "open"), { type: "separator" as const }]),
    input.starred
      ? item(many ? `Unstar ${them}` : "Unstar", "unstar")
      : item(many ? `Star ${them}` : "Star", "star"),
    ...(many ? [] : [{ type: "separator" as const }, ...single]),
    { type: "separator" },
    item(many ? `Move ${them} to Trash` : "Move to Trash", "trash"),
  ];
}

/**
 * Show the menu over the window that asked and answer with what was picked, or null when
 * it was dismissed. Revealing and copying the path happen here, where Finder and the
 * clipboard are; the rest goes back to the library, which knows the selection.
 */
export function showDocRowMenu(
  win: BrowserWindow | null,
  input: DocRowMenuInput,
  root: string,
): Promise<DocRowAction | null> {
  return new Promise((resolve, reject) => {
    let chosen: DocRowAction | null = null;
    const menu = Menu.buildFromTemplate(
      buildDocRowMenu(input, (action) => {
        chosen = action;
        if (action === "reveal") shell.showItemInFolder(join(root, input.path));
        // Answered once it is on the clipboard, so "Copied" is never said for nothing.
        if (action === "copyPath")
          clipboard.writeText(join(root, input.path)).then(() => resolve(action), reject);
        else resolve(action);
      }),
    );
    // A click's handler can run after the menu reports closing: wait a turn before
    // answering "nothing", so a choice is never lost to the order they arrive in.
    menu.popup({
      ...(win ? { window: win } : {}),
      callback: () =>
        setTimeout(() => {
          if (!chosen) resolve(null);
        }, 0),
    });
  });
}

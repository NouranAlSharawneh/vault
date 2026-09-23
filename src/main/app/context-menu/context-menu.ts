import { Menu, type WebContents } from "electron";
import { buildContextMenu } from "./build-context-menu";

/**
 * Right-click menu for a window. Electron shows none by default, which left the
 * spell-checker's squiggles with no way to act on them.
 */
export function attachContextMenu(contents: WebContents): void {
  contents.on("context-menu", (_, params) => {
    const template = buildContextMenu(params, {
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) => contents.session.addWordToSpellCheckerDictionary(word),
    });
    if (template.length > 0) Menu.buildFromTemplate(template).popup();
  });
}

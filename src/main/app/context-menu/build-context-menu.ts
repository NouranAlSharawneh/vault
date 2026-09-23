import type { ContextMenuActions, ContextMenuInput } from "./context-menu.types";

/**
 * The right-click menu for one click: spelling fixes over a misspelled word, the edit
 * roles in a field, Copy over a selection anywhere else. Empty when there is nothing to
 * offer, so the caller shows no menu at all.
 */
export function buildContextMenu(
  params: ContextMenuInput,
  actions: ContextMenuActions,
): Electron.MenuItemConstructorOptions[] {
  const items: Electron.MenuItemConstructorOptions[] = [];
  const word = params.misspelledWord;

  if (params.isEditable && word) {
    for (const suggestion of params.dictionarySuggestions) {
      items.push({ label: suggestion, click: () => actions.replaceMisspelling(suggestion) });
    }
    if (params.dictionarySuggestions.length === 0) {
      items.push({ label: "No guesses found", enabled: false });
    }
    items.push(
      { label: "Add to dictionary", click: () => actions.addToDictionary(word) },
      { type: "separator" },
    );
  }

  if (params.isEditable) {
    items.push(
      { role: "cut", enabled: params.editFlags.canCut },
      { role: "copy", enabled: params.editFlags.canCopy },
      { role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { role: "selectAll", enabled: params.editFlags.canSelectAll },
    );
  } else if (params.selectionText.trim()) {
    items.push({ role: "copy" });
  }

  return items;
}

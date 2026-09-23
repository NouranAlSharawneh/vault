/** The parts of a right-click that decide what the menu offers. */
export type ContextMenuInput = Pick<
  Electron.ContextMenuParams,
  "isEditable" | "selectionText" | "misspelledWord" | "dictionarySuggestions" | "editFlags"
>;

/** What the spelling items do; supplied by the caller so the template stays pure. */
export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void;
  addToDictionary: (word: string) => void;
}

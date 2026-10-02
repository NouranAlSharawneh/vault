import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { bracketMatching } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { formatKeymap } from "./format";

/**
 * The editor's writing aids, in one place: ( [ { and quotes close themselves, the partner
 * of the bracket at the cursor shows, and ⌘B / ⌘I / ⌘E / ⇧⌘K format the selection.
 * Ahead of the default keymap, so their keys win.
 */
export const writing = [
  closeBrackets(),
  bracketMatching(),
  formatKeymap,
  keymap.of(closeBracketsKeymap),
];

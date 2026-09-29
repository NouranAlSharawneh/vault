import { EditorSelection, type StateCommand } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/**
 * Wrap each selection in `marker` (`**` bold, `_` italic, `` ` `` code), or take it off
 * again when the selection — or the text right around it — is already wrapped. With no
 * selection, the markers go in either side of the cursor, ready to type between.
 *
 * Italic is `_`, not `*`: a `*` test would also match the first star of `**bold**`.
 */
export function toggleWrap(marker: string): StateCommand {
  const n = marker.length;

  return ({ state, dispatch }) => {
    const tr = state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      const before = state.sliceDoc(range.from - n, range.from);
      const after = state.sliceDoc(range.to, range.to + n);
      // `**bold**` selected whole: unwrap inside the selection.
      if (text.length >= 2 * n && text.startsWith(marker) && text.endsWith(marker)) {
        return {
          changes: [
            { from: range.from, to: range.from + n },
            { from: range.to - n, to: range.to },
          ],
          range: EditorSelection.range(range.from, range.to - 2 * n),
        };
      }
      // `bold` selected inside `**…**` (or the cursor between two markers): unwrap around it.
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - n, to: range.from },
            { from: range.to, to: range.to + n },
          ],
          range: EditorSelection.range(range.from - n, range.to - n),
        };
      }

      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + n, range.to + n),
      };
    });
    dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));

    return true;
  };
}

/**
 * ⌘⇧K: make a link. Selected words become its text with `url` selected to type over; a
 * selected address becomes its target with the cursor in the empty text. Nothing
 * selected gives `[](url)`, cursor in the text.
 */
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const tr = state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to);
    if (/^https?:\/\/\S+$/.test(text)) {
      const insert = `[](${text})`;

      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + 1),
      };
    }
    const label = text || "";
    const insert = `[${label}](url)`;
    const url = range.from + label.length + 3;

    return {
      changes: { from: range.from, to: range.to, insert },
      range: text ? EditorSelection.range(url, url + 3) : EditorSelection.cursor(range.from + 1),
    };
  });
  dispatch(state.update(tr, { scrollIntoView: true, userEvent: "input.format" }));

  return true;
};

/**
 * ⌘B, ⌘I, ⌘E and ⌘⇧K. Ahead of the default keymap, which spends ⌘I on "select parent
 * syntax" and ⌘⇧K on "delete line". ⌘K itself stays the app's Search.
 */
export const formatKeymap = keymap.of([
  { key: "Mod-b", run: toggleWrap("**") },
  { key: "Mod-i", run: toggleWrap("_") },
  { key: "Mod-e", run: toggleWrap("`") },
  { key: "Mod-Shift-k", run: insertLink },
]);

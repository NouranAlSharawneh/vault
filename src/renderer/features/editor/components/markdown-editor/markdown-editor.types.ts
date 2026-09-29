import type { Ref } from "react";
import type { ImageHandler } from "./extensions/images";

/** What the window can ask of the text: jump to a line (the outline), take focus. */
export interface MarkdownEditorHandle {
  /** Put the cursor at the start of `line` (1-based) and bring it to the top. */
  jumpToLine: (line: number) => void;
  focus: () => void;
}

export interface MarkdownEditorProps {
  ref?: Ref<MarkdownEditorHandle>;
  value: string;
  onChange: (value: string) => void;
  /** ⌘↵ / Ctrl↵ inside the editor. */
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** No typing, e.g. while a save is on its way. */
  readOnly?: boolean;
  /** An image pasted or dropped in: keep it, and answer the name to link it by. */
  onImage?: ImageHandler;
  /** Words in the selection, 0 when nothing is selected. */
  onSelectionWords?: (words: number) => void;
  dark?: boolean;
  className?: string;
}

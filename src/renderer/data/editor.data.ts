import type { Source } from "@shared/types";

export interface SourceOption {
  value: Source;
  label: string;
}

export const SOURCE_OPTIONS: SourceOption[] = [
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "github", label: "GitHub" },
  { value: "manual", label: "Manual" },
  { value: "other", label: "Other" },
];

export const EDITOR_PLACEHOLDER = "# Title\n\nPaste or write markdown…";

/** Why Save did nothing: an empty document is not written, and closing would lose nothing. */
export const NOTHING_TO_SAVE =
  "There’s nothing to save — the document is empty. Discard it to close the window.";

/** Tab indents in the markdown pane, so this is the way out of it by keyboard. */
export const EDITOR_LEAVE_HINT = "Esc then Tab to leave the editor";

/** What the editor's "?" lists: the keys, and what each does. */
export interface EditorShortcut {
  keys: string;
  does: string;
}

export const editorShortcuts = (mod: string, alt: string): EditorShortcut[] => [
  { keys: `${mod}S`, does: "Save and commit, keep writing" },
  { keys: `${mod}↵`, does: "Save, commit and close" },
  { keys: "Esc", does: "Close (from outside the text)" },
  { keys: "Esc, Tab", does: "Leave the text" },
  { keys: `${mod}F`, does: "Find and replace" },
  { keys: `${mod}B`, does: "Bold" },
  { keys: `${mod}I`, does: "Italic" },
  { keys: `${mod}E`, does: "Inline code" },
  { keys: `⇧${mod}K`, does: "Link" },
  { keys: `⇧${mod}O`, does: "Jump to a heading" },
  { keys: `${alt}${mod}P`, does: "Focus mode — hide the preview" },
];

import { QUERY_OPERATORS } from "@shared/constants";

export type PaletteActionKey =
  | "newFromClipboard"
  | "newDocument"
  | "trashDoc"
  | "pushPending"
  | "pullNow"
  | "reviewConflicts"
  | "rescan"
  | "settings";

export interface PaletteActionData {
  key: PaletteActionKey;
  label: string;
  shortcut?: string;
  /** Only shown when this many commits are waiting. */
  needsPending?: boolean;
  /** Only shown while a document is open in the reader. */
  needsDoc?: boolean;
  /** Only shown when versions of a document are waiting on a decision. */
  needsConflicts?: boolean;
  /** Only shown for a vault connected to GitHub; a local one has nothing to pull or push. */
  needsRemote?: boolean;
}

export const PALETTE_ACTIONS: PaletteActionData[] = [
  // No shortcut here: the capture hotkey opens the sheet, and this opens the editor.
  // Advertising ⌃⌥V against it said two different things did the same thing.
  { key: "newFromClipboard", label: "New doc from clipboard" },
  { key: "newDocument", label: "New document", shortcut: "⌘N" },
  { key: "trashDoc", label: "Move document to trash", shortcut: "⌘⌫", needsDoc: true },
  { key: "pushPending", label: "Push pending docs", needsPending: true, needsRemote: true },
  { key: "pullNow", label: "Pull from GitHub", needsRemote: true },
  { key: "reviewConflicts", label: "Review versions of a document", needsConflicts: true },
  { key: "rescan", label: "Rescan vault folder" },
  { key: "settings", label: "Settings…", shortcut: "⌘," },
];

export const PALETTE_HINTS = QUERY_OPERATORS;

import { CAPTURE_HOTKEY_LABEL } from "@/constants";
import { QUERY_OPERATORS } from "@shared/constants";

export type PaletteActionKey =
  "newFromClipboard" | "newDocument" | "trashDoc" | "pushPending" | "rescan" | "settings";

export interface PaletteActionData {
  key: PaletteActionKey;
  label: string;
  shortcut?: string;
  /** Only shown when this many commits are waiting. */
  needsPending?: boolean;
  /** Only shown while a document is open in the reader. */
  needsDoc?: boolean;
}

export const PALETTE_ACTIONS: PaletteActionData[] = [
  { key: "newFromClipboard", label: "New doc from clipboard", shortcut: CAPTURE_HOTKEY_LABEL },
  { key: "newDocument", label: "New document", shortcut: "⌘N" },
  { key: "trashDoc", label: "Move document to trash", shortcut: "⌘⌫", needsDoc: true },
  { key: "pushPending", label: "Push pending docs", needsPending: true },
  { key: "rescan", label: "Rescan vault folder" },
  { key: "settings", label: "Settings…", shortcut: "⌘," },
];

export const PALETTE_HINTS = QUERY_OPERATORS;

import { QUERY_OPERATORS } from "@shared/constants";

export type PaletteActionKey = "newFromClipboard" | "newDocument" | "pushPending" | "rescan";

export interface PaletteActionData {
  key: PaletteActionKey;
  label: string;
  shortcut?: string;
  /** Only shown when this many commits are waiting. */
  needsPending?: boolean;
}

export const PALETTE_ACTIONS: PaletteActionData[] = [
  { key: "newFromClipboard", label: "New doc from clipboard", shortcut: "⌥Space" },
  { key: "newDocument", label: "New document", shortcut: "⌘N" },
  { key: "pushPending", label: "Push pending docs", needsPending: true },
  { key: "rescan", label: "Rescan vault folder" },
];

export const PALETTE_HINTS = QUERY_OPERATORS;

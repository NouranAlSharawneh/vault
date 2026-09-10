import type { DocMeta } from "@shared/types";
import type { PaletteActionKey } from "@/data/palette.data";

export interface CommandPaletteProps {
  onClose: () => void;
  onOpenDoc: (path: string) => void;
  /** Present while a doc is open in the reader; enables "Move document to trash". */
  onTrashDoc?: () => void;
}

export type PaletteItem =
  | { kind: "doc"; doc: DocMeta; snippet?: string | null }
  | { kind: "text"; doc: DocMeta; snippet: string }
  | { kind: "action"; key: PaletteActionKey; label: string; shortcut?: string };

export interface PaletteGroup {
  title: string;
  items: PaletteItem[];
}
